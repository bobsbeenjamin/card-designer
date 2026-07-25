const backendConfigs = {
  dev: {
    apiUrl: "https://ij9i8u1wvg.execute-api.us-west-2.amazonaws.com",
    region: "us-west-2",
    userPoolClientId: "7pjs6emoi0akjaa9f1o9vmc3lr",
    userPoolId: "us-west-2_WBmJJT1YQ",
  },
  prod: {
    apiUrl: "https://55g413zjq2.execute-api.us-west-2.amazonaws.com",
    region: "us-west-2",
    userPoolClientId: "ofvkvrb4qmqi47nburkqsmud7",
    userPoolId: "us-west-2_JJcEs8uhA",
  },
};

const configEnvironment = window.location.origin === "http://localhost:3000" ? "dev" : "prod";

window.backendConfig = {
  ...backendConfigs[configEnvironment],
  environment: configEnvironment,
};
