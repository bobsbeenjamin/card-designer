const backendConfigs = {
  dev: {
    apiUrl: "https://ij9i8u1wvg.execute-api.us-west-2.amazonaws.com",
    region: "us-west-2",
    userPoolClientId: "7tlba3kd4kv5p4e1h5363s7a29",
    userPoolId: "us-west-2_lTDVLzK6E",
  },
  prod: {
    apiUrl: "https://55g413zjq2.execute-api.us-west-2.amazonaws.com",
    region: "us-west-2",
    userPoolClientId: "3jucb7dgsgteq2v98ae3uoacmq",
    userPoolId: "us-west-2_6BjuamntD",
  },
};

const configEnvironment = window.location.origin === "http://localhost:3000" ? "dev" : "prod";

window.backendConfig = {
  ...backendConfigs[configEnvironment],
  environment: configEnvironment,
};
