export const btns = {
  getId: (name) => {
    return document.getElementById(name);
  },
  insertInput: (fieldId,txt,type) => {
    const input = document.querySelector(`#${fieldId}`);

    input.value = txt;

    const focusInEvt = new window.FocusEvent('focusin',{bubbles:true});
    const focusEvt = new window.FocusEvent('focus',{bubbles:true});

    const focusOutEvt = new window.FocusEvent('focusout',{bubbles:true});
    const blurEvt = new window.FocusEvent('blur',{bubbles:true});

    const inputEvt = new window.Event((type || 'input'),{bubbles:true});

    input.dispatchEvent(focusEvt);
    input.dispatchEvent(focusInEvt);

    input.dispatchEvent(inputEvt);

    input.dispatchEvent(blurEvt);
    input.dispatchEvent(focusOutEvt);
  },
  getValue: (fieldId) => {
    const input = document.querySelector(`#${fieldId}`);
    return input.value;
  }
};
