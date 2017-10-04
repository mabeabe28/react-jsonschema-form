import jsdom, { JSDOM, VirtualConsole } from 'jsdom';


export const startDom = () => {

  const domHtml = `
    <body>
      <div id="root"></div>
    </body>
  `;

  const virtualConsole = new VirtualConsole();

  const myConsole = {
    log:(...args) => {
      console.log('DOM LOG:',args);
    },
    error:(...args) => {
      if(args[0].match(/Error: Not implemented:/)) {
        console.log('__JSDOM ERROR__',args);
        return;
      }
      console.log('DOM ERROR:',args);
      throw args;
    }
  };

  const dom = new JSDOM(domHtml, {
    virtualConsole: virtualConsole.sendTo(myConsole),
    runScripts: 'outside-only'
  });

  const rootElm = dom.window.document.body.querySelector('#root');

  global.window = dom.window;
  global.document = window.document;
  global.navigator = window.navigator
  global.React = require('react');
  global.ReactDOM = require('react-dom');

  return {
    dom,
    rootElm,
  };
};
