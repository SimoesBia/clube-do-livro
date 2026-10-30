import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { Comentario, Livro, Resenha } from '../../core/modelos';
import { SupabaseService } from '../../core/supabase.service';
import { AvatarMembroComponent } from '../../shared/avatar/avatar-membro.component';
import { TopoComponent } from '../../shared/topo/topo.component';

const AUTOR = 'quem:perfis(id, nome, avatar_id, participacoes, vitorias)';

@Component({
  selector: 'app-resenhas',
  imports: [IonContent, IonButton, IonSpinner, TopoComponent, AvatarMembroComponent],
  template: `
    <app-topo titulo="Resenhas" enfeite="📚"></app-topo>
    <ion-content [fullscreen]="true">
      <section class="intro">
        <h1 class="titulo-serif">O que você achou?</h1>
        <p class="suave">Conte como foi a leitura, dê sua nota e leia o que as outras pessoas acharam. Críticas com carinho! 💌</p>
        <ion-button (click)="alternarFormulario()">
          {{ formAberto() ? 'Fechar a ficha' : 'Escrever minha resenha ✍️' }}
        </ion-button>
      </section>

      @if (formAberto()) {
        <section class="ficha">
          <h2 class="titulo-serif">Ficha de leitura</h2>

          @if (livros().length === 0) {
            <p class="suave">
              Ainda não tem nenhum livro cadastrado. Assim que o livro do mês for definido (na aba Início), ele aparece aqui para você resenhar.
            </p>
          } @else {
            <label class="rotulo-campo" for="livro">Qual livro?</label>
            <select id="livro" class="campo" [value]="livroId()" (change)="escolherLivro($event)">
              <option value="">Escolha um livro…</option>
              @for (l of livros(); track l.id) {
                <option [value]="l.id" [selected]="l.id === livroId()">{{ l.titulo }}{{ l.autor ? ' — ' + l.autor : '' }}</option>
              }
            </select>

            <span class="rotulo-campo">Sua nota</span>
            <div class="estrelas" role="radiogroup" aria-label="Sua nota de 1 a 5">
              @for (n of [1, 2, 3, 4, 5]; track n) {
                <button
                  type="button"
                  class="estrela"
                  [class.cheia]="n <= nota()"
                  role="radio"
                  [attr.aria-checked]="n === nota()"
                  [attr.aria-label]="n + (n === 1 ? ' estrela' : ' estrelas')"
                  (click)="nota.set(n)"
                >★</button>
              }
            </div>

            <label class="rotulo-campo" for="dias">Em quantos dias você leu?</label>
            <input id="dias" class="campo" type="number" inputmode="numeric" min="0" max="3650" placeholder="Ex.: 12" [value]="dias()" (input)="dias.set($any($event.target).value)" />

            <label class="rotulo-campo" for="texto">O que você achou?</label>
            <textarea
              id="texto"
              class="campo"
              maxlength="5000"
              placeholder="Conta tudo: personagens, final, o que te fez chorar, o que te irritou…"
              [value]="texto()"
              (input)="texto.set($any($event.target).value)"
            ></textarea>

            <div class="linha-spoiler">
              <button type="button" class="pilula" [class.ativa]="spoiler()" (click)="spoiler.set(!spoiler())">
                {{ spoiler() ? '✓ Tem spoiler' : 'Tem spoiler?' }}
              </button>
              <span class="contador">{{ texto().length }}/5000</span>
            </div>

            @if (erro()) {
              <p class="erro" role="alert">{{ erro() }}</p>
            }
            @if (mensagem()) {
              <p class="aviso" role="status">{{ mensagem() }}</p>
            }

            <ion-button expand="block" [disabled]="salvando()" (click)="salvar()">
              @if (salvando()) {
                <ion-spinner name="dots"></ion-spinner>
              } @else {
                {{ jaTenhoResenha() ? 'Atualizar minha resenha' : 'Publicar resenha' }}
              }
            </ion-button>
          }
        </section>
      }

      @if (carregando()) {
        <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
      }

      @for (r of resenhas(); track r.id) {
        <article class="secao resenha">
          <header>
            <app-avatar-membro [membro]="r.quem" [tamanho]="46"></app-avatar-membro>
            <div class="quem">
              <strong>{{ r.quem?.nome ?? 'Alguém do clube' }}</strong>
              <span>{{ data(r.criado_em) }}</span>
            </div>
          </header>

          <div class="livro">
            <div class="capa" style="width: 40px; height: 58px">
              @if (r.livro?.capa_url; as capa) {
                <img [src]="capa" alt="" loading="lazy" />
              } @else {
                <span>📖</span>
              }
            </div>
            <div class="titulo">
              <strong>{{ r.livro?.titulo }}</strong>
              @if (r.livro?.autor) {
                <span>{{ r.livro?.autor }}</span>
              }
            </div>
          </div>

          <div class="nota" [attr.aria-label]="'Nota ' + r.nota + ' de 5'">
            @for (n of [1, 2, 3, 4, 5]; track n) {
              <span class="mini" [class.cheia]="n <= r.nota">★</span>
            }
            @if (r.dias_leitura !== null) {
              <span class="dias">· leu em {{ r.dias_leitura }} {{ r.dias_leitura === 1 ? 'dia' : 'dias' }}</span>
            }
          </div>

          @if (r.spoiler && !spoilerVisto()[r.id] && r.autor_id !== auth.perfil()?.id) {
            <button type="button" class="aviso-spoiler" (click)="mostrarSpoiler(r.id)">⚠️ Esta resenha tem spoiler. Toque para ler.</button>
          } @else {
            <p class="texto">{{ r.texto }}</p>
          }

          <footer>
            <button type="button" class="pilula curtir" [class.ativa]="euCurti(r.id)" (click)="curtir(r.id)" [attr.aria-pressed]="euCurti(r.id)">
              {{ euCurti(r.id) ? '♥' : '♡' }} {{ totalDeCurtidas(r.id) }}
            </button>
            <button type="button" class="pilula" (click)="alternarComentarios(r.id)">
              💬 {{ abertas()[r.id] ? 'Esconder comentários' : 'Comentários' }}
            </button>
            @if (r.autor_id === auth.perfil()?.id) {
              <button type="button" class="pilula" (click)="editar(r)">Editar</button>
              <button type="button" class="pilula apagar" (click)="apagar(r.id)">Apagar</button>
            }
          </footer>

          @if (abertas()[r.id]) {
            <div class="comentarios">
              @for (c of comentarios()[r.id] ?? []; track c.id) {
                <div class="comentario">
                  <app-avatar-membro [membro]="c.quem" [tamanho]="30"></app-avatar-membro>
                  <div class="corpo">
                    <strong>{{ c.quem?.nome ?? 'Alguém do clube' }}</strong>
                    <p>{{ c.texto }}</p>
                  </div>
                  @if (c.autor_id === auth.perfil()?.id || auth.eAdmin()) {
                    <button type="button" class="x" (click)="apagarComentario(r.id, c.id)" aria-label="Apagar comentário">✕</button>
                  }
                </div>
              } @empty {
                <p class="suave">Ninguém comentou ainda. Comece a conversa!</p>
              }
              <div class="novo">
                <input
                  class="campo"
                  type="text"
                  maxlength="1000"
                  placeholder="Escreva um comentário…"
                  [value]="rascunhos()[r.id] ?? ''"
                  (input)="digitarComentario(r.id, $event)"
                  (keyup.enter)="comentar(r.id)"
                />
                <ion-button size="small" (click)="comentar(r.id)">Enviar</ion-button>
              </div>
            </div>
          }
        </article>
      } @empty {
        @if (!carregando()) {
          <section class="secao vazio">
            <p class="suave">Nenhuma resenha ainda. Que tal ser a primeira? 📚</p>
          </section>
        }
      }
    </ion-content>
  `,
  styles: [
    `
      .intro {
        padding: 16px 18px 4px;
      }
      h1 {
        font-size: 1.8rem;
      }
      .intro ion-button {
        margin-top: 8px;
      }
      .ficha {
        position: relative;
        margin: 14px;
        padding: 18px 18px 20px 30px;
        border-radius: 6px 20px 20px 6px;
        border-left: 14px solid var(--cob-vinho);
        background: #fffaf3;
        background-image: repeating-linear-gradient(transparent, transparent 31px, rgba(209, 50, 95, 0.08) 32px);
        box-shadow: 0 10px 26px var(--cob-sombra), inset 6px 0 10px rgba(122, 18, 48, 0.1);
        animation: abrir 0.35s ease both;
      }
      @keyframes abrir {
        from { opacity: 0; transform: translateY(-8px) scale(0.98); }
        to { opacity: 1; transform: none; }
      }
      .ficha h2 {
        font-size: 1.5rem;
      }
      select.campo {
        appearance: none;
        background: #fff;
      }
      .estrelas {
        display: flex;
        gap: 4px;
      }
      .estrela {
        border: none;
        background: none;
        padding: 0 2px;
        font-size: 2.2rem;
        line-height: 1;
        color: #e9d3d8;
        cursor: pointer;
        transition: transform 0.12s ease;
      }
      .estrela.cheia {
        color: #d9a441;
        text-shadow: 0 2px 6px rgba(217, 164, 65, 0.4);
      }
      .estrela:active {
        transform: scale(1.25) rotate(8deg);
      }
      .linha-spoiler {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 10px 0 4px;
      }
      .contador {
        font-size: 0.8rem;
        color: #b58b98;
      }
      .ficha ion-button {
        margin-top: 12px;
      }
      .centro {
        display: flex;
        justify-content: center;
        padding: 14px;
      }
      .resenha header {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .quem {
        display: flex;
        flex-direction: column;
      }
      .quem span,
      .titulo span {
        color: #8c5a68;
        font-size: 0.85rem;
      }
      .livro {
        display: flex;
        gap: 12px;
        align-items: center;
        margin: 12px 0 6px;
        padding: 8px 10px;
        border-radius: 14px;
        background: #fff3f1;
      }
      .titulo {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .nota {
        display: flex;
        align-items: center;
        gap: 2px;
        margin: 4px 0 8px;
      }
      .mini {
        font-size: 1.3rem;
        color: #e9d3d8;
      }
      .mini.cheia {
        color: #d9a441;
      }
      .dias {
        margin-left: 8px;
        font-weight: 700;
        font-size: 0.85rem;
        color: #8c5a68;
      }
      .texto {
        margin: 0 0 10px;
        line-height: 1.55;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .aviso-spoiler {
        display: block;
        width: 100%;
        margin: 0 0 10px;
        padding: 16px;
        border: 1.5px dashed #d9a441;
        border-radius: 14px;
        background: #fff8e6;
        color: #5a3b00;
        font-family: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pilula.curtir.ativa {
        background: var(--cob-framboesa);
        border-color: var(--cob-framboesa);
      }
      .pilula.apagar {
        color: #b3122f;
        border-color: #f4b8c2;
      }
      .comentarios {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1.5px dashed #f0b9c4;
      }
      .comentario {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 6px 0;
      }
      .corpo {
        flex: 1;
        min-width: 0;
      }
      .corpo p {
        margin: 1px 0 0;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }
      .x {
        border: none;
        background: none;
        color: #b3122f;
        font-weight: 700;
        cursor: pointer;
      }
      .novo {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }
      .vazio {
        text-align: center;
      }
    `,
  ],
})
export class ResenhasPage {
  protected readonly auth = inject(AuthService);
  private readonly sb = inject(SupabaseService).cliente;

  protected readonly livros = signal<Livro[]>([]);
  protected readonly resenhas = signal<Resenha[]>([]);
  protected readonly carregando = signal(true);

  // ficha de leitura
  protected readonly formAberto = signal(false);
  protected readonly livroId = signal('');
  protected readonly nota = signal(0);
  protected readonly dias = signal('');
  protected readonly texto = signal('');
  protected readonly spoiler = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal('');
  protected readonly mensagem = signal('');

  // comentários
  protected readonly abertas = signal<Record<string, boolean>>({});
  protected readonly comentarios = signal<Record<string, Comentario[]>>({});
  protected readonly rascunhos = signal<Record<string, string>>({});
  protected readonly spoilerVisto = signal<Record<string, boolean>>({});

  // curtidas
  protected readonly curtidas = signal<{ resenha_id: string; perfil_id: string }[]>([]);

  protected readonly jaTenhoResenha = computed(() =>
    this.resenhas().some((r) => r.livro_id === this.livroId() && r.autor_id === this.auth.perfil()?.id),
  );

  async ionViewWillEnter() {
    await this.carregar();
  }

  private async carregar() {
    const [livros, resenhas] = await Promise.all([
      this.sb.from('livros').select('id, titulo, autor, capa_url, criado_em').order('criado_em', { ascending: false }),
      this.sb
        .from('resenhas')
        .select(`id, livro_id, autor_id, nota, dias_leitura, texto, spoiler, criado_em, livro:livros(id, titulo, autor, capa_url), ${AUTOR}`)
        .order('criado_em', { ascending: false }),
    ]);
    const curtidas = await this.sb.from('curtidas_resenha').select('resenha_id, perfil_id');
    this.curtidas.set((curtidas.data ?? []) as { resenha_id: string; perfil_id: string }[]);
    this.livros.set((livros.data ?? []) as Livro[]);
    this.resenhas.set((resenhas.data ?? []) as unknown as Resenha[]);
    this.carregando.set(false);
  }

  protected data(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  // ----- ficha de leitura -----

  protected alternarFormulario() {
    this.formAberto.set(!this.formAberto());
    this.erro.set('');
    this.mensagem.set('');
  }

  protected escolherLivro(evento: Event) {
    this.preencherPara((evento.target as HTMLSelectElement).value);
  }

  // Se a pessoa já escreveu uma resenha desse livro, a ficha abre com ela preenchida
  private preencherPara(id: string) {
    this.livroId.set(id);
    const minha = this.resenhas().find((r) => r.livro_id === id && r.autor_id === this.auth.perfil()?.id);
    this.nota.set(minha?.nota ?? 0);
    this.dias.set(minha?.dias_leitura !== null && minha?.dias_leitura !== undefined ? String(minha.dias_leitura) : '');
    this.texto.set(minha?.texto ?? '');
    this.spoiler.set(minha?.spoiler ?? false);
  }

  protected editar(r: Resenha) {
    this.formAberto.set(true);
    this.preencherPara(r.livro_id);
    this.erro.set('');
    this.mensagem.set('');
  }

  protected async salvar() {
    const meuId = this.auth.perfil()?.id;
    this.erro.set('');
    this.mensagem.set('');
    if (!meuId) return;
    if (!this.livroId()) return this.erro.set('Escolha o livro.');
    if (this.nota() < 1) return this.erro.set('Dê uma nota de 1 a 5 estrelas.');
    if (!this.texto().trim()) return this.erro.set('Conte o que você achou do livro.');

    const diasTexto = this.dias().trim();
    const dias = diasTexto === '' ? null : Math.min(3650, Math.max(0, Math.round(Number(diasTexto))));
    if (dias !== null && Number.isNaN(dias)) return this.erro.set('Escreva os dias só com números.');

    this.salvando.set(true);
    const { error } = await this.sb.from('resenhas').upsert(
      {
        livro_id: this.livroId(),
        autor_id: meuId,
        nota: this.nota(),
        dias_leitura: dias,
        texto: this.texto().trim(),
        spoiler: this.spoiler(),
      },
      { onConflict: 'livro_id,autor_id' },
    );
    this.salvando.set(false);
    if (error) return this.erro.set('Não deu para salvar a resenha agora. Tente de novo.');

    this.mensagem.set('Resenha publicada! 🎉');
    await this.carregar();
  }

  protected async apagar(id: string) {
    if (!confirm('Apagar sua resenha?')) return;
    await this.sb.from('resenhas').delete().eq('id', id);
    await this.carregar();
  }

  protected mostrarSpoiler(id: string) {
    this.spoilerVisto.update((v) => ({ ...v, [id]: true }));
  }

  // ----- curtidas -----

  protected totalDeCurtidas(id: string): number {
    return this.curtidas().filter((c) => c.resenha_id === id).length;
  }

  protected euCurti(id: string): boolean {
    const meuId = this.auth.perfil()?.id;
    return !!meuId && this.curtidas().some((c) => c.resenha_id === id && c.perfil_id === meuId);
  }

  protected async curtir(id: string) {
    const meuId = this.auth.perfil()?.id;
    if (!meuId) return;
    const antes = this.curtidas();
    if (this.euCurti(id)) {
      this.curtidas.set(antes.filter((c) => !(c.resenha_id === id && c.perfil_id === meuId)));
      const { error } = await this.sb.from('curtidas_resenha').delete().eq('resenha_id', id).eq('perfil_id', meuId);
      if (error) this.curtidas.set(antes);
    } else {
      this.curtidas.set([...antes, { resenha_id: id, perfil_id: meuId }]);
      const { error } = await this.sb.from('curtidas_resenha').insert({ resenha_id: id, perfil_id: meuId });
      if (error) this.curtidas.set(antes);
    }
  }

  // ----- comentários -----

  protected async alternarComentarios(id: string) {
    const abrir = !this.abertas()[id];
    this.abertas.update((a) => ({ ...a, [id]: abrir }));
    if (abrir) await this.carregarComentarios(id);
  }

  private async carregarComentarios(id: string) {
    const { data } = await this.sb
      .from('comentarios')
      .select(`id, resenha_id, autor_id, texto, criado_em, ${AUTOR}`)
      .eq('resenha_id', id)
      .order('criado_em', { ascending: true });
    this.comentarios.update((c) => ({ ...c, [id]: (data ?? []) as unknown as Comentario[] }));
  }

  protected digitarComentario(id: string, evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    this.rascunhos.update((r) => ({ ...r, [id]: valor }));
  }

  protected async comentar(id: string) {
    const meuId = this.auth.perfil()?.id;
    const texto = (this.rascunhos()[id] ?? '').trim();
    if (!meuId || !texto) return;
    const { error } = await this.sb.from('comentarios').insert({ resenha_id: id, autor_id: meuId, texto });
    if (error) return;
    this.rascunhos.update((r) => ({ ...r, [id]: '' }));
    await this.carregarComentarios(id);
  }

  protected async apagarComentario(resenhaId: string, id: string) {
    await this.sb.from('comentarios').delete().eq('id', id);
    await this.carregarComentarios(resenhaId);
  }
}
