import { asJson, defineExtension } from '@bridgething/extension';

// deno globals are not typed in this workspace; only what we use
declare const Deno: {
  Command: new (cmd: string, opts: { args: string[] }) => { output(): Promise<{ code: number; stderr: Uint8Array }> };
};

type Msg = { type: 'schedule'; inMs: number; title: string; body: string } | { type: 'cancel' };

let timer: ReturnType<typeof setTimeout> | undefined;

defineExtension({
  start(ctx) {
    ctx.on('message', (device, message) => {
      const msg = asJson<Msg>(message);
      if (!msg) return;
      clearTimeout(timer);
      if (msg.type !== 'schedule' || typeof msg.inMs !== 'number') return;
      const { title, body } = msg;
      const config = ctx.config(device);
      if (config.mac_alerts === 'false') return; // the user turned mac alerts off in settings
      const sound = config.sound ?? 'Glass';
      timer = setTimeout(
        () => notify(String(title), String(body), sound).catch(err => ctx.log.error('notify failed', String(err))),
        Math.max(0, msg.inMs),
      );
      ctx.log.info(`alert in ${Math.round(msg.inMs / 1000)}s: ${title}`);
    });
  },
  stop() {
    clearTimeout(timer);
  },
});

// text goes in argv so it never becomes applescript source
async function notify(title: string, body: string, sound: string) {
  const show = 'display notification (item 2 of argv) with title (item 1 of argv)';
  const script = ['on run argv', sound.startsWith('Ninguno') ? show : `${show} sound name (item 3 of argv)`, 'end run'];
  const { code, stderr } = await new Deno.Command('osascript', {
    args: [...script.flatMap(line => ['-e', line]), title, body, sound],
  }).output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
}
