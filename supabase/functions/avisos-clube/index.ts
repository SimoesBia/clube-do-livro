import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGEM = 'https://court-of-books.vercel.app';
const REMETENTE = 'Court of Books <clube@avisos.metodoselecto.com>';

function segredoIgual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diferenca = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diferenca |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diferenca === 0;
}

async function enviar(destino: string, assunto: string, texto: string, chave: string) {
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + Deno.env.get('RESEND_API_KEY'),
      'Content-Type': 'application/json',
      'Idempotency-Key': chave,
    },
    body: JSON.stringify({ from: REMETENTE, to: [destino], subject: assunto,
      text: texto + '\n\nCourt of Books · ' + ORIGEM + '\nPreferências de avisos em Meu perfil → Avatares.' }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) throw new Error('Resend HTTP ' + resposta.status);
}

Deno.serve(async (requisicao: Request) => {
  const segredo = Deno.env.get('EMAIL_WORKER_SECRET');
  if (requisicao.method !== 'POST' || !segredo || !segredoIgual(requisicao.headers.get('x-worker-secret') ?? '', segredo)) {
    return new Response('Não autorizado', { status: 401 });
  }
  if (!Deno.env.get('RESEND_API_KEY')) return new Response('Configure RESEND_API_KEY', { status: 503 });
  const corpo = await requisicao.json().catch(() => ({}));
  try {
    if (corpo.teste === true) {
      const destino = Deno.env.get('EMAIL_TESTE');
      if (!destino) return new Response('Configure EMAIL_TESTE', { status: 400 });
      await enviar(destino, 'Teste do Court of Books pelo Supabase',
        'A função de avisos está conectada. A ativação dos eventos é feita separadamente no SQL Editor.',
        'teste-' + crypto.randomUUID());
      return Response.json({ teste_enviado: true });
    }
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.rpc('reservar_emails');
    if (error) throw new Error('Não consegui reservar a fila');
    let enviados = 0;
    for (const email of data ?? []) {
      let sucesso = false;
      let falha: string | null = null;
      try {
        // Reconfere cancelamentos/remarcações após reservar.
        const { data: registro } = await sb.from('fila_emails').select('estado,reserva')
          .eq('id', email.id).maybeSingle();
        if (registro?.estado !== 'processando' || registro.reserva !== email.reserva) continue;
        if (!email.destinatario) throw new Error('Conta sem e-mail');
        const rota = /^\/app\/[a-z]+$/.test(email.rota) ? email.rota : '/app/inicio';
        await enviar(email.destinatario, email.assunto, email.texto + '\n\nAbrir no app: ' + ORIGEM + rota, email.id);
        sucesso = true;
        enviados++;
      } catch (erro) {
        falha = erro instanceof Error ? erro.message : 'Falha de envio';
      }
      const { error: erroFinal } = await sb.rpc('finalizar_email', {
        p_id: email.id, p_reserva: email.reserva, p_sucesso: sucesso, p_erro: falha,
      });
      if (erroFinal) console.error('Falha ao finalizar item da fila');
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    return Response.json({ enviados });
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : 'Falha na função');
    return new Response('Falha ao processar avisos. Consulte Logs.', { status: 500 });
  }
});
