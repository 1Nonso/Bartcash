interface Config {
   port: number;
   nodeEnv: any;
}

const config: Config = {
   port: Number(process.env.PORT),
   nodeEnv: process.env.NODE_ENV,
};

export default config;
