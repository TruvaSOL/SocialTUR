import { GAME } from '../config/game';
import { NAME_MAX, cleanName, isOldEnough } from '../game/profile';
import type { RedeemResult, TicketCheck } from '../game/server';
import { type TextKey, t } from '../i18n';
import { DEFAULT_LOOK, LOOK_FIELDS, type Look, randomLook } from '../world/looks';

export interface NewFan {
  code: string;
  name: string;
  birthYear: number;
  look: Look;
}

export interface OnboardingHooks {
  /** The editor is about to show: point the camera at the character. */
  onEditorOpen(): void;
  /** A choice changed: redraw the character. */
  onLookChange(look: Look): void;
  /** Asks the server whether the code can be used. */
  checkTicket(code: string): Promise<TicketCheck>;
  /** Takes the seat. */
  takeSeat(fan: NewFan): Promise<RedeemResult>;
  /** The sheet closed without taking a seat (the visitor chose to just look). */
  onSpectate(): void;
}

type Step = 'ticket' | 'age' | 'editor' | null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Shows a code as the visitor types it: upper case, grouped as XXXX-XXXX. */
function formatCode(raw: string): string {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/**
 * The sheet a newcomer sees: ticket code, birth year, then the character editor.
 * The same editor is reused later to change the character. All text comes from the language files.
 */
export class Onboarding {
  private step: Step = null;
  private code = '';
  private birthYear = 0;
  private name = '';
  private look: Look = { ...DEFAULT_LOOK };
  /** The message shown on the current step, as a text key. */
  private error: TextKey | null = null;
  private busy = false;
  /** Set while editing an existing character: called instead of taking a seat. */
  private onSave: ((name: string, look: Look) => void) | null = null;

  constructor(
    private root: HTMLElement,
    private hooks: OnboardingHooks,
  ) {}

  get open(): boolean {
    return this.step !== null;
  }

  /** First visit: ticket, age, editor, then the seat. */
  startNew(code: string): void {
    this.onSave = null;
    this.code = formatCode(code);
    this.look = randomLook(Math.random);
    this.name = '';
    this.go('ticket');
  }

  /** Later visits: change the character and name. */
  edit(name: string, look: Look, onSave: (name: string, look: Look) => void): void {
    this.onSave = onSave;
    this.name = name;
    this.look = { ...look };
    this.go('editor');
  }

  /** Closes whatever is showing. */
  dismiss(): void {
    if (this.step) this.close();
  }

  /** Redraw in the current language. */
  refresh(): void {
    if (this.step) this.render();
  }

  private go(step: Step, error: TextKey | null = null): void {
    this.step = step;
    this.error = error;
    this.busy = false;
    if (step === 'editor') {
      this.hooks.onEditorOpen();
      this.hooks.onLookChange(this.look);
    }
    this.render();
  }

  private close(): void {
    this.step = null;
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  private render(): void {
    const sheet = this.root;
    sheet.hidden = false;
    sheet.replaceChildren();
    sheet.dataset.step = this.step ?? '';
    if (this.step === 'ticket') this.renderTicket(sheet);
    else if (this.step === 'age') this.renderAge(sheet);
    else if (this.step === 'editor') this.renderEditor(sheet);
  }

  private renderTicket(sheet: HTMLElement): void {
    sheet.append(el('h1', '', GAME.name), el('p', '', t('ticket.intro')));
    const input = el('input', 'code');
    input.type = 'text';
    input.value = this.code;
    input.placeholder = 'XXXX-XXXX';
    input.maxLength = 9;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'characters');
    input.setAttribute('aria-label', t('ticket.label'));
    input.addEventListener('input', () => {
      this.code = formatCode(input.value);
      input.value = this.code;
    });
    sheet.append(input);
    if (this.error) sheet.append(el('p', 'error', t(this.error)));
    const actions = el('div', 'sheet-actions');
    const watch = el('button', '', t('ticket.watch'));
    watch.type = 'button';
    watch.addEventListener('click', () => {
      this.close();
      this.hooks.onSpectate();
    });
    const next = el('button', 'primary', t(this.busy ? 'common.wait' : 'common.continue'));
    next.type = 'button';
    next.disabled = this.busy;
    next.addEventListener('click', async () => {
      if (this.code.replace('-', '').length !== 8) {
        this.go('ticket', 'ticket.invalid');
        return;
      }
      this.busy = true;
      this.render();
      const answer = await this.hooks.checkTicket(this.code);
      if (this.step !== 'ticket') return;
      if (answer === 'ok') this.go('age');
      else this.go('ticket', `ticket.${answer}` as TextKey);
    });
    actions.append(watch, next);
    sheet.append(actions);
  }

  private renderAge(sheet: HTMLElement): void {
    sheet.append(el('h2', '', t('age.title')), el('p', '', t('age.hint')));
    const select = el('select');
    select.setAttribute('aria-label', t('age.title'));
    const placeholder = el('option', '', t('age.choose'));
    placeholder.value = '';
    select.append(placeholder);
    const thisYear = new Date().getFullYear();
    for (let year = thisYear - 5; year >= thisYear - 100; year--) {
      const option = el('option', '', String(year));
      option.value = String(year);
      if (year === this.birthYear) option.selected = true;
      select.append(option);
    }
    sheet.append(select);
    if (this.error) sheet.append(el('p', 'error', t(this.error, { age: GAME.minAge })));
    const next = el('button', 'primary', t('common.continue'));
    next.type = 'button';
    next.addEventListener('click', () => {
      this.birthYear = Number(select.value);
      if (!this.birthYear) return;
      if (!isOldEnough(this.birthYear)) {
        this.go('age', 'age.tooYoung');
        return;
      }
      this.go('editor');
    });
    sheet.append(next);
  }

  private renderEditor(sheet: HTMLElement): void {
    sheet.append(el('h2', '', t(this.onSave ? 'editor.editTitle' : 'editor.title')));

    const nameRow = el('label', 'field');
    nameRow.append(el('span', '', t('editor.name')));
    const input = el('input');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.value = this.name;
    input.placeholder = t('editor.namePlaceholder');
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      this.name = input.value;
    });
    nameRow.append(input);
    sheet.append(nameRow);
    if (this.error) sheet.append(el('p', 'error', t(this.error)));

    const rows = el('div', 'rows');
    for (const field of LOOK_FIELDS) {
      const row = el('div', 'row');
      row.append(el('span', 'row-label', t(`look.${field.key}` as TextKey)));
      const options = el('div', 'options');
      for (let i = 0; i < field.count; i++) {
        const label = field.colors ? '' : t(`look.${field.key}.${i}` as TextKey);
        const button = el('button', field.colors ? 'swatch' : 'choice', label);
        button.type = 'button';
        if (field.colors) {
          button.style.background = hex(field.colors[i]);
          button.setAttribute('aria-label', `${t(`look.${field.key}` as TextKey)} ${i + 1}`);
        }
        button.setAttribute('aria-pressed', String(this.look[field.key] === i));
        button.addEventListener('click', () => {
          this.look[field.key] = i;
          this.hooks.onLookChange(this.look);
          for (const other of options.children) other.setAttribute('aria-pressed', String(other === button));
        });
        options.append(button);
      }
      row.append(options);
      rows.append(row);
    }
    sheet.append(rows);

    const actions = el('div', 'sheet-actions');
    const random = el('button', '', t('editor.random'));
    random.type = 'button';
    random.addEventListener('click', () => {
      this.look = randomLook(Math.random);
      this.hooks.onLookChange(this.look);
      this.render();
    });
    const done = el('button', 'primary', t(this.busy ? 'common.wait' : this.onSave ? 'editor.save' : 'editor.takeSeat'));
    done.type = 'button';
    done.disabled = this.busy;
    done.addEventListener('click', async () => {
      const name = cleanName(this.name);
      if (!name) {
        this.go('editor', 'editor.nameError');
        return;
      }
      const look = { ...this.look };
      if (this.onSave) {
        const onSave = this.onSave;
        this.close();
        onSave(name, look);
        return;
      }
      this.busy = true;
      this.render();
      const result = await this.hooks.takeSeat({ code: this.code, name, birthYear: this.birthYear, look });
      if (result.ok) {
        this.close();
        return;
      }
      // Send the visitor back to the step that can fix the problem.
      if (result.error === 'invalid' || result.error === 'used' || result.error === 'full') this.go('ticket', `ticket.${result.error}`);
      else if (result.error === 'too_young') this.go('age', 'age.tooYoung');
      else if (result.error === 'invalid_name') this.go('editor', 'editor.nameError');
      else this.go('editor', `seat.${result.error}` as TextKey);
    });
    actions.append(random, done);
    sheet.append(actions);
  }
}
