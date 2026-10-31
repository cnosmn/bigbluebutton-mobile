// Signs release builds with the key described in keystore.properties (project
// root, gitignored). Without that file release builds fall back to the debug
// key, so anyone can still build the project.
//
// keystore.properties:
//   storeFile=credentials/derslik-release.jks   (relative to the project root)
//   storePassword=...
//   keyAlias=...
//   keyPassword=...
//
// Also limits native libraries to ARM, which covers Android tablets and
// phones; x86 builds only matter for emulators.
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const LOAD_PROPERTIES = `
def releaseSigning = new Properties()
def releaseSigningFile = rootProject.file('../keystore.properties')
if (releaseSigningFile.exists()) {
    releaseSigningFile.withInputStream { releaseSigning.load(it) }
}
`;

const RELEASE_CONFIG = `
        if (!releaseSigning.isEmpty()) {
            release {
                storeFile rootProject.file("../" + releaseSigning['storeFile'])
                storePassword releaseSigning['storePassword']
                keyAlias releaseSigning['keyAlias']
                keyPassword releaseSigning['keyPassword']
            }
        }`;

function replaceOnce(contents, search, replacement) {
  if (!contents.includes(search)) {
    throw new Error(`withReleaseSigning: could not find "${search.trim()}" in app/build.gradle`);
  }
  return contents.replace(search, replacement);
}

function withReleaseSigning(config) {
  config = withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes('releaseSigning')) return mod;

    gradle = replaceOnce(gradle, '\nandroid {', `${LOAD_PROPERTIES}\nandroid {`);
    gradle = replaceOnce(gradle, '    signingConfigs {', `    signingConfigs {${RELEASE_CONFIG}`);
    gradle = replaceOnce(
      gradle,
      '// see https://reactnative.dev/docs/signed-apk-android.\n            signingConfig signingConfigs.debug',
      '// see https://reactnative.dev/docs/signed-apk-android.\n' +
        '            signingConfig releaseSigning.isEmpty() ? signingConfigs.debug : signingConfigs.release',
    );
    mod.modResults.contents = gradle;
    return mod;
  });

  return withGradleProperties(config, (mod) => {
    const architectures = mod.modResults.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures',
    );
    if (architectures) architectures.value = 'armeabi-v7a,arm64-v8a';
    return mod;
  });
}

module.exports = withReleaseSigning;
