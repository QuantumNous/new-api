declare const _exports: {
  "allowed-hosts": {
    configs: (
      | {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
          values: string[];
        }
    )[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "allowed-hosts-reset": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  bonjour: {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  client: {
    configs: {
      description: string;
      negatedDescription: string;
      multiple: boolean;
      path: string;
      type: string;
      values: boolean[];
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "client-logging": {
    configs: {
      type: string;
      values: string[];
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-overlay": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-overlay-errors": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-overlay-trusted-types-policy-name": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "client-overlay-warnings": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-overlay-runtime-errors": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-progress": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-reconnect": {
    configs: (
      | {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }
      | {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-web-socket-transport": {
    configs: (
      | {
          type: string;
          values: string[];
          multiple: boolean;
          description: string;
          path: string;
        }
      | {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-web-socket-url": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-web-socket-url-hostname": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-web-socket-url-password": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-web-socket-url-pathname": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-web-socket-url-port": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "client-web-socket-url-protocol": {
    configs: (
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
          values: string[];
        }
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }
    )[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "client-web-socket-url-username": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  compress: {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "history-api-fallback": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  host: {
    configs: (
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
          values: string[];
        }
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  hot: {
    configs: (
      | {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }
      | {
          type: string;
          values: string[];
          multiple: boolean;
          description: string;
          path: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  http2: {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  https: {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "https-ca": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "https-ca-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "https-cacert": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "https-cacert-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "https-cert": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "https-cert-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "https-crl": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "https-crl-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "https-key": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "https-key-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "https-passphrase": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "https-pfx": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "https-pfx-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "https-request-cert": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  ipc: {
    configs: (
      | {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }
      | {
          type: string;
          values: boolean[];
          multiple: boolean;
          description: string;
          path: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "live-reload": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "magic-html": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  open: {
    configs: (
      | {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }
      | {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "open-app": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "open-app-name": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "open-app-name-reset": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "open-reset": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "open-target": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "open-target-reset": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  port: {
    configs: (
      | {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }
      | {
          type: string;
          values: string[];
          multiple: boolean;
          description: string;
          path: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "server-options-ca": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-ca-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-cacert": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-cacert-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-cert": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-cert-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-crl": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-crl-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-key": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-key-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-passphrase": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-pfx": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-pfx-reset": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-options-request-cert": {
    configs: {
      description: string;
      negatedDescription: string;
      multiple: boolean;
      path: string;
      type: string;
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  "server-type": {
    configs: {
      description: string;
      multiple: boolean;
      path: string;
      type: string;
      values: string[];
    }[];
    description: string;
    multiple: boolean;
    simpleType: string;
  };
  static: {
    configs: (
      | {
          type: string;
          multiple: boolean;
          description: string;
          path: string;
        }
      | {
          type: string;
          multiple: boolean;
          description: string;
          negatedDescription: string;
          path: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "static-directory": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "static-public-path": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "static-public-path-reset": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "static-reset": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "static-serve-index": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "static-watch": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      negatedDescription: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "watch-files": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "watch-files-reset": {
    configs: {
      type: string;
      multiple: boolean;
      description: string;
      path: string;
    }[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "web-socket-server": {
    configs: (
      | {
          description: string;
          negatedDescription: string;
          multiple: boolean;
          path: string;
          type: string;
          values: boolean[];
        }
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
          values: string[];
        }
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
  "web-socket-server-type": {
    configs: (
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
          values: string[];
        }
      | {
          description: string;
          multiple: boolean;
          path: string;
          type: string;
        }
    )[];
    description: string;
    simpleType: string;
    multiple: boolean;
  };
};
export = _exports;
