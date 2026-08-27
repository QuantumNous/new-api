package selfupdate

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	dockerUpdateHelperCommand = "__new_api_docker_update_helper"
	helperStartDelay          = 2 * time.Second
	defaultPollInterval       = time.Second
	defaultReadinessTimeout   = 90 * time.Second
	defaultRunningGrace       = 3 * time.Second
)

type helperHostConfig struct {
	Binds       []string `json:"Binds,omitempty"`
	AutoRemove  bool     `json:"AutoRemove"`
	NetworkMode string   `json:"NetworkMode,omitempty"`
}

// RunDockerUpdateHelper handles the private helper command before normal
// application initialization. It must not parse flags or open the database.
func RunDockerUpdateHelper(args []string) (bool, error) {
	if len(args) < 2 || args[1] != dockerUpdateHelperCommand {
		return false, nil
	}
	if len(args) != 7 {
		return true, fmt.Errorf("invalid docker update helper arguments")
	}

	dropDockerImageEnv, err := strconv.ParseBool(args[5])
	if err != nil {
		return true, fmt.Errorf("parse helper environment mode: %w", err)
	}
	var prepared *composePreparedUpdate
	if args[6] != "" {
		specBytes, err := base64.RawURLEncoding.DecodeString(args[6])
		if err != nil {
			return true, fmt.Errorf("decode compose update specification: %w", err)
		}
		var spec composeSyncSpec
		if err := common.Unmarshal(specBytes, &spec); err != nil {
			return true, fmt.Errorf("parse compose update specification: %w", err)
		}
		prepared, err = composePreparedFromSpec(spec)
		if err != nil {
			return true, err
		}
	}

	eng, err := NewDockerEngine(args[4])
	if err != nil {
		return true, err
	}
	d, ok := eng.(*dockerEngineImpl)
	if !ok {
		return true, fmt.Errorf("unexpected docker engine implementation")
	}

	time.Sleep(helperStartDelay)
	ctx, cancel := context.WithTimeout(context.Background(), defaultReadinessTimeout+30*time.Second)
	defer cancel()
	return true, d.replaceContainer(ctx, args[2], args[3], DockerRecreateOptions{
		DropDockerImageEnv: dropDockerImageEnv,
		composePrepared:    prepared,
	})
}

func (d *dockerEngineImpl) scheduleRecreateHelper(ctx context.Context, ci *ContainerInspect, targetImage string, options DockerRecreateOptions) error {
	if ci == nil || ci.ID == "" {
		return fmt.Errorf("current container ID is empty")
	}
	if targetImage == "" {
		return fmt.Errorf("target image is required")
	}
	if !isSafeImageReference(targetImage) {
		return fmt.Errorf("target image is invalid")
	}

	network, socketPath := d.network, d.address
	if network == "" || socketPath == "" {
		network, socketPath = parseDockerHost(d.dockerHost)
	}
	if network != "unix" {
		return fmt.Errorf("docker self-update helper requires a unix socket, got %s", network)
	}

	prepared, err := prepareComposeSync(ci, options.ComposeSync, targetImage)
	if err != nil {
		return err
	}
	options.composePrepared = prepared

	dockerHost := d.dockerHost
	if dockerHost == "" {
		dockerHost = "unix://" + socketPath
	}

	socketSource := socketPath
	for _, mount := range ci.Mounts {
		if mount.Destination == socketPath && mount.Source != "" {
			socketSource = mount.Source
			break
		}
	}
	binds := []string{socketSource + ":" + socketPath + ":rw"}
	if prepared != nil {
		binds = append(binds, prepared.hostDir+":"+composeHelperDir+":rw")
	}
	hostConfig, err := common.Marshal(helperHostConfig{
		Binds:       binds,
		AutoRemove:  true,
		NetworkMode: "none",
	})
	if err != nil {
		return fmt.Errorf("marshal helper host config: %w", err)
	}
	helperImage := ci.Image
	if helperImage == "" {
		helperImage = ci.Config.Image
	}
	if helperImage == "" {
		return fmt.Errorf("current container image is empty")
	}

	composeSpec := ""
	if prepared != nil {
		specBytes, err := common.Marshal(prepared.spec)
		if err != nil {
			return fmt.Errorf("marshal compose update specification: %w", err)
		}
		composeSpec = base64.RawURLEncoding.EncodeToString(specBytes)
	}
	bodyBytes, err := common.Marshal(containerCreateBody{
		Image:      helperImage,
		Entrypoint: []string{"/new-api"},
		Cmd: []string{
			dockerUpdateHelperCommand,
			ci.ID,
			targetImage,
			dockerHost,
			strconv.FormatBool(options.DropDockerImageEnv),
			composeSpec,
		},
		Labels: map[string]string{
			"io.new-api.selfupdate.helper": "true",
		},
		HostConfig: hostConfig,
	})
	if err != nil {
		return fmt.Errorf("marshal helper container: %w", err)
	}

	helperName := fmt.Sprintf("new-api-update-helper-%d", time.Now().UnixNano())
	helperID, err := d.createContainer(ctx, helperName, bodyBytes)
	if err != nil {
		return fmt.Errorf("create update helper: %w", err)
	}
	if err := d.postEmpty(ctx, "/containers/"+url.PathEscape(helperID)+"/start"); err != nil {
		_ = d.deleteContainer(ctx, helperID)
		return fmt.Errorf("start update helper: %w", err)
	}
	return nil
}

func (d *dockerEngineImpl) replaceContainer(ctx context.Context, oldID, targetImage string, options DockerRecreateOptions) error {
	if !isSafeImageReference(targetImage) {
		return fmt.Errorf("target image is invalid")
	}
	if err := options.composePrepared.validateMounted(targetImage); err != nil {
		return fmt.Errorf("validate compose declaration: %w", err)
	}

	ci, err := d.inspectContainer(ctx, oldID)
	if err != nil {
		return fmt.Errorf("inspect old container: %w", err)
	}
	name := strings.TrimPrefix(ci.Name, "/")
	if name == "" {
		return fmt.Errorf("old container name is empty")
	}

	var backup *composeBackup
	if err := d.stopContainer(ctx, oldID); err != nil {
		return fmt.Errorf("stop old container: %w", err)
	}
	oldIDSuffix := oldID
	if len(oldIDSuffix) > 12 {
		oldIDSuffix = oldIDSuffix[:12]
	}
	if err := d.renameContainer(ctx, oldID, name+"-updating-old-"+oldIDSuffix); err != nil {
		restartErr := d.postEmpty(ctx, "/containers/"+url.PathEscape(oldID)+"/start")
		if restoreErr := backup.Restore(); restoreErr != nil {
			if restartErr != nil {
				return errors.Join(
					fmt.Errorf("rename old container: %w", err),
					fmt.Errorf("restart old container after failed rename: %w", restartErr),
					fmt.Errorf("restore compose declaration: %w", restoreErr),
				)
			}
			return errors.Join(
				fmt.Errorf("rename old container: %w", err),
				fmt.Errorf("restore compose declaration: %w", restoreErr),
			)
		}
		if restartErr != nil {
			return errors.Join(
				fmt.Errorf("rename old container: %w", err),
				fmt.Errorf("restart old container after failed rename: %w", restartErr),
			)
		}
		return fmt.Errorf("rename old container: %w", err)
	}

	rollback := func(newContainerID string) error {
		rollbackCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		var recoveryErrs []error
		if newContainerID != "" {
			if err := d.deleteContainer(rollbackCtx, newContainerID); err != nil {
				recoveryErrs = append(recoveryErrs, fmt.Errorf("remove replacement container: %w", err))
			}
		}
		if err := d.renameContainer(rollbackCtx, oldID, name); err != nil {
			recoveryErrs = append(recoveryErrs, fmt.Errorf("restore old container name: %w", err))
		}
		if err := d.postEmpty(rollbackCtx, "/containers/"+url.PathEscape(oldID)+"/start"); err != nil {
			recoveryErrs = append(recoveryErrs, fmt.Errorf("restart old container: %w", err))
		}
		if err := backup.Restore(); err != nil {
			recoveryErrs = append(recoveryErrs, fmt.Errorf("restore compose declaration: %w", err))
		}
		return errors.Join(recoveryErrs...)
	}
	withRollback := func(primary error, newContainerID string) error {
		if rollbackErr := rollback(newContainerID); rollbackErr != nil {
			return errors.Join(primary, fmt.Errorf("rollback failed: %w", rollbackErr))
		}
		return primary
	}

	bodyBytes, err := common.Marshal(replacementContainerBody(ci, targetImage, options.DropDockerImageEnv))
	if err != nil {
		return withRollback(fmt.Errorf("marshal replacement container: %w", err), "")
	}
	newContainerID, err := d.createContainer(ctx, name, bodyBytes)
	if err != nil {
		return withRollback(fmt.Errorf("create replacement container: %w", err), "")
	}
	if err := d.postEmpty(ctx, "/containers/"+url.PathEscape(newContainerID)+"/start"); err != nil {
		return withRollback(fmt.Errorf("start replacement container: %w", err), newContainerID)
	}
	if err := d.waitForContainerReady(ctx, newContainerID); err != nil {
		return withRollback(fmt.Errorf("replacement container is not ready: %w", err), newContainerID)
	}
	backup, err = options.composePrepared.applyMounted(targetImage)
	if err != nil {
		return withRollback(fmt.Errorf("synchronize compose declaration: %w", err), newContainerID)
	}
	if err := d.deleteContainer(ctx, oldID); err != nil {
		if backup != nil && backup.backupPath != "" {
			return fmt.Errorf("replacement container is healthy and compose declaration is synchronized, but remove old container: %w; retain %s for manual recovery", err, backup.backupPath)
		}
		return fmt.Errorf("replacement container is healthy, but remove old container: %w", err)
	}
	if err := backup.Finalize(); err != nil {
		return fmt.Errorf("replacement container is healthy and old container is removed, but finalize compose declaration: %w", err)
	}
	return nil
}

func replacementContainerBody(ci *ContainerInspect, targetImage string, dropDockerImageEnv bool) containerCreateBody {
	env := ci.Config.Env
	if dropDockerImageEnv {
		env = filterEnv(env, "NEWAPI_DOCKER_IMAGE")
	}

	hostname := ci.Config.Hostname
	if len(hostname) == 12 && strings.HasPrefix(ci.ID, hostname) {
		hostname = ""
	}

	var hostConfigSummary struct {
		NetworkMode string `json:"NetworkMode"`
	}
	_ = common.Unmarshal(ci.HostConfig, &hostConfigSummary)
	preserveNetworks := !ci.Config.NetworkDisabled &&
		hostConfigSummary.NetworkMode != "host" &&
		hostConfigSummary.NetworkMode != "none" &&
		!strings.HasPrefix(hostConfigSummary.NetworkMode, "container:")

	var networkingConfig *containerNetworkingConfig
	if preserveNetworks && len(ci.NetworkSettings.Networks) > 0 {
		endpoints := make(map[string]*containerEndpointSettings, len(ci.NetworkSettings.Networks))
		for name, endpoint := range ci.NetworkSettings.Networks {
			if endpoint == nil {
				endpoints[name] = &containerEndpointSettings{}
				continue
			}
			endpoints[name] = &containerEndpointSettings{
				IPAMConfig: endpoint.IPAMConfig,
				Links:      endpoint.Links,
				Aliases:    endpoint.Aliases,
				DriverOpts: endpoint.DriverOpts,
			}
		}
		networkingConfig = &containerNetworkingConfig{EndpointsConfig: endpoints}
	}

	return containerCreateBody{
		Hostname:         hostname,
		Domainname:       ci.Config.Domainname,
		User:             ci.Config.User,
		AttachStdin:      ci.Config.AttachStdin,
		AttachStdout:     ci.Config.AttachStdout,
		AttachStderr:     ci.Config.AttachStderr,
		ExposedPorts:     ci.Config.ExposedPorts,
		Tty:              ci.Config.Tty,
		OpenStdin:        ci.Config.OpenStdin,
		StdinOnce:        ci.Config.StdinOnce,
		Env:              env,
		Cmd:              ci.Config.Cmd,
		Healthcheck:      ci.Config.Healthcheck,
		ArgsEscaped:      ci.Config.ArgsEscaped,
		Image:            targetImage,
		Volumes:          ci.Config.Volumes,
		WorkingDir:       ci.Config.WorkingDir,
		Entrypoint:       ci.Config.Entrypoint,
		NetworkDisabled:  ci.Config.NetworkDisabled,
		MacAddress:       ci.Config.MacAddress,
		OnBuild:          ci.Config.OnBuild,
		Labels:           ci.Config.Labels,
		StopSignal:       ci.Config.StopSignal,
		StopTimeout:      ci.Config.StopTimeout,
		Shell:            ci.Config.Shell,
		HostConfig:       ci.HostConfig,
		NetworkingConfig: networkingConfig,
	}
}

func (d *dockerEngineImpl) stopContainer(ctx context.Context, id string) error {
	query := url.Values{"t": {"10"}}
	req, err := d.client.request(ctx, http.MethodPost,
		"/containers/"+url.PathEscape(id)+"/stop?"+query.Encode(), nil,
	)
	if err != nil {
		return err
	}
	resp, err := d.client.call(req)
	if err != nil {
		return err
	}
	defer drain(resp)
	if (resp.StatusCode < 200 || resp.StatusCode >= 300) && resp.StatusCode != http.StatusNotModified {
		return fmt.Errorf("POST /containers/%s/stop: HTTP %d", id, resp.StatusCode)
	}
	return nil
}

func (d *dockerEngineImpl) waitForContainerReady(ctx context.Context, id string) error {
	pollInterval := d.pollInterval
	if pollInterval <= 0 {
		pollInterval = defaultPollInterval
	}
	timeout := d.readinessTimeout
	if timeout <= 0 {
		timeout = defaultReadinessTimeout
	}
	runningGrace := d.runningGrace
	if runningGrace <= 0 {
		runningGrace = defaultRunningGrace
	}

	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	var runningSince time.Time

	for {
		ci, err := d.inspectContainer(ctx, id)
		if err != nil {
			return err
		}
		if !ci.State.Running {
			if ci.State.Status == "exited" || ci.State.Status == "dead" {
				return fmt.Errorf("container %s (exit code %d): %s", ci.State.Status, ci.State.ExitCode, ci.State.Error)
			}
			runningSince = time.Time{}
		} else if ci.State.Health != nil {
			switch ci.State.Health.Status {
			case "healthy":
				return nil
			case "unhealthy":
				return fmt.Errorf("container health status is unhealthy")
			}
		} else if ci.Config.Healthcheck == nil || len(ci.Config.Healthcheck.Test) == 0 || ci.Config.Healthcheck.Test[0] == "NONE" {
			if runningSince.IsZero() {
				runningSince = time.Now()
			} else if time.Since(runningSince) >= runningGrace {
				return nil
			}
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline.C:
			return fmt.Errorf("timed out after %s", timeout)
		case <-ticker.C:
		}
	}
}
