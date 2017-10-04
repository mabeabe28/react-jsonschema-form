import test from 'tape';
import syncFlow from 'sync-flow';
import * as utils from './_utils';

test('000', t => {

  const { dom, rootElm } = utils.startDom();
  const { btns } = require('./_helpers');
  const From = require('../src/index').default;

  const schema = {
    type: 'object',
    required: ['title'],
    properties: { title: {type: 'string', title: 'Title'} }
  };

  let changeMe = 'unchanged';

  syncFlow([
    () => {
      ReactDOM.render(<From
        schema={schema}
        onChange={({formData}) => changeMe = formData.title}
      />, rootElm);
    },
    () => {
      btns.insertInput('root_title','Hello');
    },
    () => {
      const value = btns.getValue('root_title');
      t.equal(value,'Hello');
      t.equal(changeMe,'Hello');
      t.end();
    }
  ],t.end,100);
});
