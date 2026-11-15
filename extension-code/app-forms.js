// Name: App Forms
// ID: appforms
// Description: Form builder with typed fields and validation. Requires the App Dialogs extension. Build forms by ID inside a C block, then show any of them.
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
  const DEFAULT_ID = 'form1';
  const COLORS = ['#0ea5e9', '#0284c7', '#0369a1'];

  const RESTRICT_TO_FORM = true;
  const FIELD_NOTCH = `${EXT_ID}-field`;
  const fieldNotch = RESTRICT_TO_FORM ? { notchAccepts: FIELD_NOTCH } : {};

  const NOTCH_STYLE = 'round';
  const NOTCH_STYLES = {
    round: 'h 4 c 3 0 3 8 6 8 h 16 c 3 0 3 -8 6 -8 h 4',
    zigzag: 'h 6 l 6 8 l 6 -4 l 6 4 l 6 -8 h 6',
    trapezoid: 'l 8 8 h 20 l 8 -8'
  };

  if (RESTRICT_TO_FORM && Scratch.gui && Scratch.gui.getBlockly) {
    Scratch.gui
      .getBlockly()
      .then((ScratchBlocks) => {
        const BlockSvg = ScratchBlocks && ScratchBlocks.BlockSvg;
        if (!BlockSvg || typeof BlockSvg.registerCustomNotch !== 'function') return;
        BlockSvg.registerCustomNotch(FIELD_NOTCH, NOTCH_STYLES[NOTCH_STYLE] || NOTCH_STYLES.round);
        try {
          if (runtime.requestToolboxExtensionsUpdate) runtime.requestToolboxExtensionsUpdate();
        } catch (e) {}
      })
      .catch(() => {});
  }

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const isTrue = (v) => /^(on|true|1|yes)$/i.test(Cast.toString(v).trim());
  const cleanId = (v) => Cast.toString(v).trim().slice(0, 60);

  const fire = (opcode) => {
    try {
      runtime.startHats(`${EXT_ID}_${opcode}`);
    } catch (e) {}
  };

  const refreshToolbox = () => {
    try {
      if (runtime.requestToolboxExtensionsUpdate) runtime.requestToolboxExtensionsUpdate();
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

  const forms = new Map();
  let currentId = '';
  let lastShownId = '';
  let last = { submitted: false, values: Object.create(null) };

  const newForm = (id) => ({
    id,
    title: '',
    message: '',
    fields: [],
    submitLabel: 'Submit',
    cancelLabel: 'Cancel'
  });

  const getCurrent = () => {
    if (!currentId || !forms.has(currentId)) {
      currentId = currentId || DEFAULT_ID;
      if (!forms.has(currentId)) {
        forms.set(currentId, newForm(currentId));
      }
    }
    return forms.get(currentId);
  };

  let warned = false;
  const showModal = (opts) => {
    const api = runtime.appUtilsDialogs;
    if (!api) {
      if (!warned) {
        warned = true;
        console.error('[App Forms] The App Dialogs extension must be loaded (unsandboxed) for forms to appear.');
      }
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

  const B = (def) => ({
    color1: COLORS[0],
    color2: COLORS[1],
    color3: COLORS[2],
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

  class AppForms {
    getInfo() {
      return {
        id: EXT_ID,
        name: 'App Forms',
        color1: COLORS[0],
        color2: COLORS[1],
        color3: COLORS[2],
        blocks: [
          label('Build a form'),
          B({
            opcode: 'formDefine',
            blockType: BT.CONDITIONAL || BT.LOOP,
            branchCount: 1,
            ...(RESTRICT_TO_FORM ? { branches: [{ accepts: FIELD_NOTCH }] } : {}),
            text: 'form [ID] titled [TITLE] message [MESSAGE]',
            arguments: {
              ID: str(DEFAULT_ID),
              TITLE: str('Sign up'),
              MESSAGE: str('Fill in your details')
            }
          }),
          B({
            opcode: 'formAddField',
            blockType: BT.COMMAND,
            ...fieldNotch,
            text: 'add [TYPE] field [NAME] label [LABEL] default [DEFAULT]',
            arguments: {
              TYPE: str('text', 'formFieldTypes'),
              NAME: str('email'),
              LABEL: str('Email'),
              DEFAULT: str('')
            }
          }),
          B({
            opcode: 'formAddChoice',
            blockType: BT.COMMAND,
            ...fieldNotch,
            text: 'add [KIND] field [NAME] label [LABEL] options [OPTIONS] default [DEFAULT]',
            arguments: {
              KIND: str('select', 'formChoiceKinds'),
              NAME: str('plan'),
              LABEL: str('Plan'),
              OPTIONS: str('Free,Pro,Team'),
              DEFAULT: str('')
            }
          }),
          B({
            opcode: 'formSetAttr',
            blockType: BT.COMMAND,
            ...fieldNotch,
            text: 'set field [NAME] [ATTR] to [VALUE]',
            arguments: { NAME: str('email'), ATTR: str('required', 'formAttrs'), VALUE: str('true') }
          }),
          B({
            opcode: 'formRemoveField',
            blockType: BT.COMMAND,
            ...fieldNotch,
            text: 'remove field [NAME]',
            arguments: { NAME: str('email') }
          }),
          B({
            opcode: 'formSetButtons',
            blockType: BT.COMMAND,
            ...fieldNotch,
            text: 'set form buttons submit [SUBMIT] cancel [CANCEL]',
            arguments: { SUBMIT: str('Create account'), CANCEL: str('Not now') }
          }),
          B({
            opcode: 'formEdit',
            blockType: BT.CONDITIONAL || BT.LOOP,
            branchCount: 1,
            ...(RESTRICT_TO_FORM ? { branches: [{ accepts: FIELD_NOTCH }] } : {}),
            text: 'edit form [ID]',
            arguments: { ID: str(DEFAULT_ID) }
          }),
          B({
            opcode: 'formSetTitle',
            blockType: BT.COMMAND,
            ...fieldNotch,
            text: 'set form title [TITLE] message [MESSAGE]',
            arguments: { TITLE: str('Sign up'), MESSAGE: str('Fill in your details') }
          }),

          label('Show and manage'),
          B({
            opcode: 'formShow',
            blockType: BT.COMMAND,
            text: 'show form [ID] and wait',
            arguments: { ID: str(DEFAULT_ID) }
          }),
          B({
            opcode: 'formShowNoWait',
            blockType: BT.COMMAND,
            text: 'show form [ID]',
            arguments: { ID: str(DEFAULT_ID) }
          }),
          B({
            opcode: 'formList',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'list of forms'
          }),
          B({
            opcode: 'formExists',
            blockType: BT.BOOLEAN,
            text: 'form [ID] exists?',
            arguments: { ID: str(DEFAULT_ID) }
          }),
          B({
            opcode: 'formDelete',
            blockType: BT.COMMAND,
            text: 'delete form [ID]',
            arguments: { ID: str(DEFAULT_ID) }
          }),
          B({ opcode: 'formDeleteAll', blockType: BT.COMMAND, text: 'delete all forms' }),

          label('Result'),
          B({ opcode: 'formWasSubmitted', blockType: BT.BOOLEAN, text: 'form was submitted?' }),
          B({
            opcode: 'formValue',
            blockType: BT.REPORTER,
            text: 'form value of [NAME]',
            arguments: { NAME: str('email') }
          }),
          B({
            opcode: 'formResultJson',
            blockType: BT.REPORTER,
            blockShape: SH.PLUS,
            text: 'form result as JSON object'
          }),
          B({
            opcode: 'formFieldCount',
            blockType: BT.REPORTER,
            text: 'number of fields in form [ID]',
            arguments: { ID: str(DEFAULT_ID) }
          }),
          B({
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

    formDefine({ ID, TITLE, MESSAGE }, util) {
      const frame = util.stackFrame;
      if (frame.started) return;
      frame.started = true;
      const id = cleanId(ID) || DEFAULT_ID;
      const f = newForm(id);
      f.title = Cast.toString(TITLE);
      f.message = Cast.toString(MESSAGE);
      forms.set(id, f);
      currentId = id;
      util.startBranch(1, true);
    }

    formEdit({ ID }, util) {
      const frame = util.stackFrame;
      if (frame.started) return;
      frame.started = true;
      const id = cleanId(ID);
      if (!forms.has(id)) return;
      currentId = id;
      util.startBranch(1, true);
    }

    formSetTitle({ TITLE, MESSAGE }) {
      const form = getCurrent();
      form.title = Cast.toString(TITLE);
      form.message = Cast.toString(MESSAGE);
    }

    formAddField({ TYPE, NAME, LABEL, DEFAULT }) {
      this._putField(NAME, Cast.toString(TYPE), LABEL, DEFAULT, []);
    }

    formAddChoice({ KIND, NAME, LABEL, OPTIONS, DEFAULT }) {
      const kind = Cast.toString(KIND) === 'radio' ? 'radio' : 'select';
      this._putField(NAME, kind, LABEL, DEFAULT, parseList(OPTIONS));
    }

    _putField(rawName, type, label, value, options) {
      const form = getCurrent();
      const name = Cast.toString(rawName).trim().slice(0, 60) || `field${form.fields.length + 1}`;
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
      const f = getCurrent().fields.find((x) => x.name === Cast.toString(NAME).trim());
      if (!f) return;
      const attr = Cast.toString(ATTR);
      switch (attr) {
        case 'required':
        case 'disabled':
          f[attr] = isTrue(VALUE);
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
      const form = getCurrent();
      const name = Cast.toString(NAME).trim();
      form.fields = form.fields.filter((f) => f.name !== name);
    }

    formSetButtons({ SUBMIT, CANCEL }) {
      const form = getCurrent();
      form.submitLabel = Cast.toString(SUBMIT).trim().slice(0, 40);
      form.cancelLabel = Cast.toString(CANCEL).trim().slice(0, 40);
    }

    async formShow({ ID }) {
      const id = cleanId(ID);
      const form = forms.get(id);
      lastShownId = id;
      last = { submitted: false, values: Object.create(null) };
      if (!form || form.fields.length === 0) return;
      const buttons = [];
      if (form.cancelLabel) buttons.push({ label: form.cancelLabel, cancel: true });
      buttons.push({ label: form.submitLabel || dialogStyle.okLabel || 'Submit', primary: true });
      const r = await showModal({
        title: form.title,
        message: form.message,
        fields: form.fields.map((f) => ({ ...f })),
        buttons
      });
      last = { submitted: !r.cancelled, values: r.cancelled ? Object.create(null) : r.values };
      if (last.submitted) fire('whenFormSubmitted');
    }

    formShowNoWait({ ID }) {
      this.formShow({ ID }).catch(() => {});
    }

    formList() {
      return JSON.stringify([...forms.keys()]);
    }

    formExists({ ID }) {
      return forms.has(cleanId(ID));
    }

    formDelete({ ID }) {
      const id = cleanId(ID);
      if (!forms.delete(id)) return;
      if (currentId === id) currentId = '';
    }

    formDeleteAll() {
      forms.clear();
      currentId = '';
      lastShownId = '';
      last = { submitted: false, values: Object.create(null) };
    }

    formWasSubmitted() {
      return last.submitted;
    }

    formValue({ NAME }) {
      const v = last.values[Cast.toString(NAME).trim()];
      if (v === undefined) return '';
      return typeof v === 'boolean' ? String(v) : v;
    }

    formResultJson() {
      return JSON.stringify(last.values);
    }

    formFieldCount({ ID }) {
      const f = forms.get(cleanId(ID));
      return f ? f.fields.length : 0;
    }

    whenFormSubmitted() {
      return true;
    }
  }

  Scratch.extensions.register(new AppForms());
})(Scratch);