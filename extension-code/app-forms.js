// Name: App Forms
// ID: appforms
// Description: Form builder with typed fields and validation. Requires the App Dialogs extension.
// License: MIT

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('App Forms must be loaded as an "Unsandboxed" extension.');
  }

  const Cast = Scratch.Cast;

  const runtime = Scratch.vm.runtime;

  const BT = Scratch.BlockType;

  const AT = Scratch.ArgumentType;

  const SH = Scratch.BlockShape || {};

  const EXT_ID = 'appforms';

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  const fire = (opcode) => {
    try {
      runtime.startHats(`${EXT_ID}_${opcode}`);
    } catch (e) {}
  };

  const parseList = (v) => {
    const s = Cast.toString(v).trim();
    if (s.startsWith('[')) {
      try {
        const a = JSON.parse(s);
        if (Array.isArray(a)) return a.map(String);
      } catch (e) {}
    }
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  };

  const form = {
    title: '',
    message: '',
    fields: [],
    submitLabel: 'Submit',
    cancelLabel: 'Cancel',
    result: Object.create(null),
    submitted: false
  };

  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  const COLORS = {
    forms: ['#0ea5e9', '#0284c7', '#0369a1']
  };

  const B = (section, def) => ({
    color1: COLORS[section][0],
    color2: COLORS[section][1],
    color3: COLORS[section][2],
    ...def
  });

  const label = (text) => ({ blockType: BT.LABEL, text });

  const str = (defaultValue, menu) => {
    const a = { type: AT.STRING, defaultValue: defaultValue === undefined ? '' : defaultValue };
    if (menu) a.menu = menu;
    return a;
  };

  const items = (list) => ({ acceptReporters: true, items: list });

  const pairs = (list) => list.map(([text, value]) => ({ text, value }));

  const showModal = (opts) => {
    const api = runtime.appUtilsDialogs;
    if (!api) {
      console.warn('App Forms needs the App Dialogs extension to be loaded.');
      return Promise.resolve({ value: '', cancelled: true, text: '', values: Object.create(null) });
    }
    return api.showModal(opts);
  };

  const dialogStyle = new Proxy(
    {},
    {
      get: (_, key) => (runtime.appUtilsDialogs ? runtime.appUtilsDialogs.style[key] : undefined)
    }
  );

  class AppForms {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Forms',
        color1: '#0ea5e9',
        color2: '#0284c7',
        color3: '#0369a1',
        blocks: [
          label('Form builder'),
          B('forms', {
            opcode: 'formStart',
            blockType: BT.COMMAND,
            text: 'new form titled [TITLE] message [MESSAGE]',
            arguments: { TITLE: str('Sign up'), MESSAGE: str('Fill in your details') }
          }),
          B('forms', {
            opcode: 'formAddField',
            blockType: BT.COMMAND,
            text: 'add [TYPE] field [NAME] label [LABEL] default [DEFAULT]',
            arguments: {
              TYPE: str('text', 'formFieldTypes'),
              NAME: str('email'),
              LABEL: str('Email'),
              DEFAULT: str('')
            }
          }),
          B('forms', {
            opcode: 'formAddChoice',
            blockType: BT.COMMAND,
            text: 'add [KIND] field [NAME] label [LABEL] options [OPTIONS] default [DEFAULT]',
            arguments: {
              KIND: str('select', 'formChoiceKinds'),
              NAME: str('plan'),
              LABEL: str('Plan'),
              OPTIONS: str('Free,Pro,Team'),
              DEFAULT: str('')
            }
          }),
          B('forms', {
            opcode: 'formSetAttr',
            blockType: BT.COMMAND,
            text: 'set field [NAME] [ATTR] to [VALUE]',
            arguments: { NAME: str('email'), ATTR: str('required', 'formAttrs'), VALUE: str('true') }
          }),
          B('forms', {
            opcode: 'formRemoveField',
            blockType: BT.COMMAND,
            text: 'remove field [NAME] from form',
            arguments: { NAME: str('email') }
          }),
          B('forms', {
            opcode: 'formSetButtons',
            blockType: BT.COMMAND,
            text: 'set form buttons submit [SUBMIT] cancel [CANCEL]',
            arguments: { SUBMIT: str('Create account'), CANCEL: str('Not now') }
          }),
          B('forms', { opcode: 'formShow', blockType: BT.COMMAND, text: 'show form and wait' }),
          B('forms', { opcode: 'formWasSubmitted', blockType: BT.BOOLEAN, text: 'form was submitted?' }),
          B('forms', {
            opcode: 'formValue',
            blockType: BT.REPORTER,
            text: 'form value of [NAME]',
            arguments: { NAME: str('email') }
          }),
          B('forms', {
            opcode: 'formResultJson',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'form result as JSON object'
          }),
          B('forms', { opcode: 'formFieldCount', blockType: BT.REPORTER, text: 'number of form fields' }),
          B('forms', {
            opcode: 'whenFormSubmitted',
            blockType: BT.HAT,
            isEdgeActivated: false,
            text: 'when a form is submitted'
          })
        ],
        menus: {
          formFieldTypes: items(
            pairs([
              ['text', 'text'],
              ['password', 'password'],
              ['email', 'email'],
              ['number', 'number'],
              ['long text', 'textarea'],
              ['checkbox', 'checkbox'],
              ['date', 'date'],
              ['time', 'time'],
              ['date & time', 'datetime-local'],
              ['color', 'color'],
              ['slider', 'range'],
              ['phone', 'tel'],
              ['URL', 'url']
            ])
          ),
          formChoiceKinds: items(
            pairs([
              ['dropdown', 'select'],
              ['radio buttons', 'radio']
            ])
          ),
          formAttrs: items(
            pairs([
              ['default value', 'value'],
              ['placeholder', 'placeholder'],
              ['hint', 'hint'],
              ['required', 'required'],
              ['minimum', 'min'],
              ['maximum', 'max'],
              ['step', 'step'],
              ['min length', 'minLength'],
              ['max length', 'maxLength'],
              ['pattern (regex)', 'pattern'],
              ['error message', 'errorMessage'],
              ['disabled', 'disabled']
            ])
          )
        }
      };
    }

    formStart({ TITLE, MESSAGE }) {
      form.title = Cast.toString(TITLE);
      form.message = Cast.toString(MESSAGE);
      form.fields = [];
      form.submitLabel = 'Submit';
      form.cancelLabel = 'Cancel';
      form.result = Object.create(null);
      form.submitted = false;
    }

    formAddField({ TYPE, NAME, LABEL, DEFAULT }) {
      this._putField(NAME, Cast.toString(TYPE), LABEL, DEFAULT, []);
    }

    formAddChoice({ KIND, NAME, LABEL, OPTIONS, DEFAULT }) {
      const kind = Cast.toString(KIND) === 'radio' ? 'radio' : 'select';
      this._putField(NAME, kind, LABEL, DEFAULT, parseList(OPTIONS));
    }

    _putField(rawName, type, label, value, options) {
      let name = Cast.toString(rawName).trim().slice(0, 60) || `field${form.fields.length + 1}`;
      if (FORBIDDEN_KEYS.has(name)) name = `_${name}`;
      const field = {
        name,
        type,
        label: Cast.toString(label).slice(0, 200),
        value: Cast.toString(value),
        placeholder: '',
        hint: '',
        required: false,
        min: '',
        max: '',
        step: '',
        minLength: 0,
        maxLength: 0,
        pattern: '',
        errorMessage: '',
        disabled: false,
        options
      };
      const i = form.fields.findIndex((f) => f.name === name);
      if (i >= 0) form.fields[i] = field;
      else if (form.fields.length < 40) form.fields.push(field);
    }

    formSetAttr({ NAME, ATTR, VALUE }) {
      const f = form.fields.find((x) => x.name === Cast.toString(NAME).trim());
      if (!f) return;
      const attr = Cast.toString(ATTR);
      switch (attr) {
        case 'required':
        case 'disabled':
          f[attr] = /^(on|true|1|yes)$/i.test(Cast.toString(VALUE).trim());
          break;
        case 'minLength':
        case 'maxLength':
          f[attr] = clamp(Math.floor(Cast.toNumber(VALUE)), 0, 10000);
          break;
        case 'value':
        case 'placeholder':
        case 'hint':
        case 'pattern':
        case 'errorMessage':
        case 'min':
        case 'max':
        case 'step':
          f[attr] = Cast.toString(VALUE).slice(0, 300);
          break;
        default:
          break;
      }
    }

    formRemoveField({ NAME }) {
      const name = Cast.toString(NAME).trim();
      form.fields = form.fields.filter((f) => f.name !== name);
    }

    formSetButtons({ SUBMIT, CANCEL }) {
      form.submitLabel = Cast.toString(SUBMIT).trim().slice(0, 40);
      form.cancelLabel = Cast.toString(CANCEL).trim().slice(0, 40);
    }

    async formShow() {
      if (form.fields.length === 0) {
        form.submitted = false;
        return;
      }
      const buttons = [];
      if (form.cancelLabel) buttons.push({ label: form.cancelLabel, cancel: true });
      buttons.push({ label: form.submitLabel || dialogStyle.okLabel || 'Submit', primary: true });
      const r = await showModal({
        title: form.title,
        message: form.message,
        fields: form.fields.map((f) => ({ ...f })),
        buttons
      });
      form.submitted = !r.cancelled;
      form.result = r.cancelled ? Object.create(null) : r.values;
      if (form.submitted) fire('whenFormSubmitted');
    }

    formWasSubmitted() {
      return form.submitted;
    }

    formValue({ NAME }) {
      const v = form.result[Cast.toString(NAME).trim()];
      return v === undefined ? '' : v;
    }

    formResultJson() {
      return JSON.stringify(form.result);
    }

    formFieldCount() {
      return form.fields.length;
    }

    whenFormSubmitted() {
      return true;
    }
  }

  Scratch.extensions.register(new AppForms());
})(Scratch);
