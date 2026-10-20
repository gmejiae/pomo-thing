import { settings, type ConfigField, type SettingsContext } from '@bridgething/client/settings';
import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const UI = {
  es: {
    title: 'Ajustes de',
    hint: 'Los cambios se aplican al guardar.',
    connecting: 'conectando...',
    empty: 'no hay ajustes.',
    save: 'Guardar',
    close: 'Cerrar',
    saving: 'guardando...',
    saved: '¡Listo! Ya se aplicó en tu Car Thing.',
    labels: {
      lang: 'Idioma',
      focus: 'Enfoque del preset 1 (min)',
      short: 'Descanso corto del preset 1 (min)',
      long: 'Descanso largo (min)',
      every: 'Descanso largo cada N enfoques',
      goal: 'Meta diaria de pomodoros',
      mac_alerts: 'Avisos en la Mac',
      sound: 'Sonido del aviso',
    } as Record<string, string>,
  },
  en: {
    title: 'Settings for',
    hint: 'Changes apply when you save.',
    connecting: 'connecting...',
    empty: 'no settings.',
    save: 'Save',
    close: 'Close',
    saving: 'saving...',
    saved: 'Done! Your Car Thing is updated.',
    labels: {
      lang: 'Language',
      focus: 'Preset 1 focus (min)',
      short: 'Preset 1 short break (min)',
      long: 'Long break (min)',
      every: 'Long break every N focus blocks',
      goal: 'Daily pomodoro goal',
      mac_alerts: 'Mac alerts',
      sound: 'Alert sound',
    } as Record<string, string>,
  },
};

function Settings() {
  const [ctx, setCtx] = useState<SettingsContext | null>(null);
  const [fields, setFields] = useState<ConfigField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCtx(await settings.context());
        const [schema, entries] = await Promise.all([settings.config.fields(), settings.config.list()]);
        setFields(schema);
        setValues(Object.fromEntries(entries.map(e => [e.key, e.value])));
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const valueOf = (field: ConfigField) => values[field.data.key] ?? String(field.data.default ?? '');
  // the page follows the language picked in the form, even before saving
  const ui = UI[(values.lang ?? 'Español') === 'English' ? 'en' : 'es'];

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(ui.saving);
    try {
      for (const field of fields) await settings.config.set(field.data.key, valueOf(field));
      setStatus(ui.saved);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main>
      <h1>
        {ui.title} {ctx?.name ?? 'Pomo'}
      </h1>
      <p className="hint">{ctx ? ui.hint : ui.connecting}</p>

      <form onSubmit={saveConfig}>
        {fields.length === 0 && <p className="hint">{ui.empty}</p>}
        {fields.map(field => {
          const key = field.data.key;
          const value = valueOf(field);
          const set = (v: string) => setValues({ ...values, [key]: v });
          const label = ui.labels[key] ?? field.data.label;
          if (field.type === 'boolean')
            return (
              <div className="field" key={key}>
                <label htmlFor={key}>
                  <input id={key} type="checkbox" checked={value === 'true'} onChange={e => set(String(e.currentTarget.checked))} />{' '}
                  {label}
                </label>
              </div>
            );
          return (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              {field.type === 'enum' ? (
                <select id={key} value={value} onInput={e => set(e.currentTarget.value)}>
                  {field.data.choices.map(choice => (
                    <option value={choice} key={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={key}
                  type={field.type === 'number' ? 'number' : field.type === 'secret' ? 'password' : 'text'}
                  {...(field.type === 'number' ? { min: field.data.min ?? undefined, max: field.data.max ?? undefined } : {})}
                  value={value}
                  onInput={e => set(e.currentTarget.value)}
                />
              )}
            </div>
          );
        })}

        <div className="row">
          <button type="submit">{ui.save}</button>
          <button type="button" className="secondary" onClick={() => settings.done()}>
            {ui.close}
          </button>
        </div>
      </form>

      <p className="status">{status}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Settings />);
