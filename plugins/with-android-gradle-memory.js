const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS =
  '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

/**
 * Raises Gradle heap/metaspace for release builds (fixes Metaspace OOM on local EAS builds).
 */
function withAndroidGradleMemory(config) {
  return withGradleProperties(config, (gradleConfig) => {
    const props = gradleConfig.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'org.gradle.jvmargs'),
    );
    props.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    gradleConfig.modResults = props;
    return gradleConfig;
  });
}

module.exports = withAndroidGradleMemory;
