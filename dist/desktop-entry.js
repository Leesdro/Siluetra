import './vendor/desktop-ui.js';
import * as editor from './app.js';
import {installSpectrumBridge,setSpectrumTheme} from './editor/spectrum-bridge.js';
const bridge=installSpectrumBridge(editor);
const theme=document.querySelector('#siluetra-theme');
const updateTheme=()=>setSpectrumTheme(theme,document.documentElement.getAttribute('data-theme')==='dark');
updateTheme();const observer=new MutationObserver(updateTheme);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
window.addEventListener('pagehide',e=>{if(!e.persisted){bridge.dispose();observer.disconnect();editor.workspace.dispose();}});
