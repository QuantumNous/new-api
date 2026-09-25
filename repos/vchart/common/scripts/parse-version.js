// see more about the regex here: https://semver.org/lang/zh-CN/
// reg test: https://regex101.com/r/vkijKf/1/

function parseVersion(version) {
  const res = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/gm.exec(version);

  if (res) {
    return {
      major: +res[1],
      minor: +res[2],
      patch: +res[3],
      preReleaseName: res[4],
      preReleaseType: res[4] && res[4].includes('.') ? res[4].split('.')[0] : res[4],
      buildName: res[5],
      buildType: res[5] && res[5].includes('.') ? res[5].split('.')[0] : res[5],
      
    };
  }

  return null;
}	

module.exports = parseVersion