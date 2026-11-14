import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({mode}) => {
 const host=loadEnv(mode,process.cwd(),'').NEUROPROXY_WEB_HOST?.trim();
 return {server:{allowedHosts:host ? [host] : [],proxy:{'/api':'http://127.0.0.1:3000'}}};
});
