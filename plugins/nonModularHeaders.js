const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withNonModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      let podfile = fs.readFileSync(podfilePath, "utf8");

      if (!podfile.includes("CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")) {
        podfile = podfile.replace(
          /post_install do \|installer\|[\s\S]*?end/,
          (match) => {
            return match.replace(
              /end$/,
              `
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
    end
  end
end`
            );
          }
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
