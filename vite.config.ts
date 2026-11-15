import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({mode}) => {
 const host=loadEnv(mode,process.cwd(),'').NEUROPROXY_WEB_HOST?.trim();
 const preview=mode==='interactive-preview';
 return {
  define:{__NEUROPROXY_PREVIEW__:JSON.stringify(preview)},
  plugins: preview ? [{name:'preview-csp',transformIndexHtml(html:string){return html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">');}}] : [],
  server:{allowedHosts:host ? [host] : [],proxy:{'/api':'http://127.0.0.1:3000'}}
 };
});
