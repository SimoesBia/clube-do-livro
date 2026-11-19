import { Component, inject, signal, viewChild } from '@angular/core';
import { IonButton, IonContent, IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { Comentario, Livro, Resenha, ResultadoBusca } from '../../core/modelos';
import { SupabaseService } from '../../core/supabase.service';
import { AvatarMembroComponent } from '../../shared/avatar/avatar-membro.component';
import { BuscaLivroComponent } from '../../shared/busca-livro/busca-livro.component';
import { TopoComponent } from '../../shared/topo/topo.component';

// "!autor_id" diz ao Supabase qual ligação usar (a tabela de comentários e a de curtidas também ligam resenhas a perfis)
type Origem = 'clube' | 'pessoal';
type ResenhaFeed = Resenha & { tipo: Origem; total_curtidas: number; eu_curti: boolean; total_comentarios: number };

const AUTOR = 'quem:perfis!autor_id(id, nome, avatar_id, participacoes, vitorias)';

@Component({
  selector: 'app-resenhas',
  imports: [IonContent, IonButton, IonSpinner, TopoComponent, AvatarMembroComponent, BuscaLivroComponent, IonInfiniteScroll, IonInfiniteScrollContent],
  template: `
    <app-topo titulo="Resenhas" enfeite="📚"></app-topo>
    <ion-content [fullscreen]="true">
      <section class="intro">
        <h1 class="titulo-serif">Leituras do clube</h1>
        <p class="suave">As resenhas do clube e as leituras pessoais de todas nós, das mais recentes às antigas. 💌</p>
        <ion-button (click)="alternarFormulario()">
          {{ formAberto() ? 'Fechar a ficha' : 'Escrever resenha ✍️' }}
        </ion-button>
        <button type="button" class="pilula" [disabled]="carregando()" (click)="atualizar()">Atualizar feed</button>
      </section>

      @if (formAberto()) {
        <section class="ficha">
          <h2 class="titulo-serif">Ficha de leitura</h2>

          <div class="tipos" aria-label="Tipo de resenha">
            <button type="button" class="pilula" [class.ativa]="origem() === 'clube'" [disabled]="salvando()" (click)="trocarOrigem('clube')">Livro do clube</button>
            <button type="button" class="pilula" [class.ativa]="origem() === 'pessoal'" [disabled]="salvando()" (click)="trocarOrigem('pessoal')">Leitura pessoal</button>
          </div>
          @if (origem() === 'pessoal') {
            @if (editandoId()) { <p>Editando: {{ tituloEdicao() }}</p> }
            @else { <app-busca-livro [(escolhido)]="livroPessoal" placeholder="Busque o livro da sua resenha"></app-busca-livro> }
          }
          @if (origem() === 'clube' && livros().length === 0) {
            <p class="suave">
              Ainda não tem nenhum livro cadastrado. Assim que o livro do mês for definido (na aba Início), ele aparece aqui para você resenhar.
            </p>
          } @else {
            @if (origem() === 'clube') {
            <label class="rotulo-campo" for="livro">Qual livro?</label>
            <select id="livro" [disabled]="salvando()" class="campo" [value]="livroId()" (change)="escolherLivro($event)">
              <option value="">Escolha um livro…</option>
              @for (l of livros(); track l.id) {
                <option [value]="l.id" [selected]="l.id === livroId()">{{ l.titulo }}{{ l.autor ? ' — ' + l.autor : '' }}</option>
              }
            </select>
            }

            @if (preenchendo()) { <p role="status">Abrindo sua ficha…</p> }
            <span class="rotulo-campo">Sua nota</span>
            <div class="estrelas" role="radiogroup" aria-label="Sua nota de 1 a 5">
              @for (n of [1, 2, 3, 4, 5]; track n) {
                <button
                  type="button"
                  class="estrela"
                  [disabled]="preenchendo() || salvando()"
                  [class.cheia]="n <= nota()"
                  role="radio"
                  [attr.aria-checked]="n === nota()"
                  [attr.aria-label]="n + (n === 1 ? ' estrela' : ' estrelas')"
                  (click)="nota.set(n)"
                >★</button>
              }
            </div>

            @if (origem() === 'clube') {
            <label class="rotulo-campo" for="dias">Em quantos dias você leu?</label>
            <input id="dias" [disabled]="preenchendo() || salvando()" class="campo" type="number" inputmode="numeric" min="0" max="3650" placeholder="Ex.: 12" [value]="dias()" (input)="dias.set($any($event.target).value)" />
            }

            <label class="rotulo-campo" for="texto">O que você achou?</label>
            <textarea
              id="texto"
              [disabled]="preenchendo() || salvando()"
              class="campo"
              maxlength="5000"
              placeholder="Conta tudo: personagens, final, o que te fez chorar, o que te irritou…"
              [value]="texto()"
              (input)="texto.set($any($event.target).value)"
            ></textarea>

            <div class="linha-spoiler">
              <button type="button" class="pilula" [class.ativa]="spoiler()" [disabled]="preenchendo() || salvando()" (click)="spoiler.set(!spoiler())">
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

            <ion-button expand="block" [disabled]="salvando() || preenchendo()" (click)="salvar()">
              @if (salvando()) {
                <ion-spinner name="dots"></ion-spinner>
              } @else {
                {{ editandoId() ? 'Atualizar minha resenha' : 'Publicar resenha' }}
              }
            </ion-button>
          }
        </section>
      }

      @if (carregando() && resenhas().length === 0) {
        <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
      }
      @if (erroDaLista()) {
        <div class="lista-erro"><p class="erro" role="alert">{{ erroDaLista() }}</p>
          <button type="button" class="pilula" [disabled]="carregando()" (click)="carregarMais()">Tentar novamente</button>
        </div>
      }

      @for (r of resenhas(); track chave(r)) {
        <article class="secao resenha">
          <header>
            <app-avatar-membro [membro]="r.quem" [tamanho]="46"></app-avatar-membro>
            <div class="quem">
              <strong>{{ r.quem?.nome ?? 'Alguém do clube' }}</strong>
              <span>{{ data(r.criado_em) }}</span>
              <span class="origem-resenha">{{ r.tipo === 'clube' ? '📚 Livro do clube' : '📖 Leitura pessoal' }}</span>
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
                <span>{{ r.livro.autor }}</span>
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

          @if (r.spoiler && !spoilerVisto()[chave(r)] && r.autor_id !== auth.perfil()?.id) {
            <button type="button" class="aviso-spoiler" (click)="mostrarSpoiler(chave(r))">⚠️ Esta resenha tem spoiler. Toque para ler.</button>
          } @else {
            <p class="texto">{{ r.texto }}</p>
          }

          <footer>
            <button type="button" class="pilula curtir" [disabled]="ocupadas()[chave(r)]" [class.ativa]="euCurti(chave(r))" (click)="curtir(chave(r))" [attr.aria-pressed]="euCurti(chave(r))">
              {{ euCurti(chave(r)) ? '♥' : '♡' }} {{ totalDeCurtidas(chave(r)) }}
            </button>
            <button type="button" class="pilula" (click)="alternarComentarios(chave(r))">
              💬 {{ abertas()[chave(r)] ? 'Esconder comentários' : 'Comentários (' + r.total_comentarios + ')' }}
            </button>
            @if (r.autor_id === auth.perfil()?.id) {
              <button type="button" class="pilula" [disabled]="salvando()" (click)="editar(r)">Editar</button>
              <button type="button" class="pilula apagar" [disabled]="ocupadas()[chave(r)]" (click)="apagar(chave(r))">Apagar</button>
            }
          </footer>

          @if (errosInteracao()[chave(r)]) { <p class="erro" role="alert">{{ errosInteracao()[chave(r)] }}</p> }
          @if (abertas()[chave(r)]) {
            <div class="comentarios">
              @for (c of comentarios()[chave(r)] ?? []; track c.id) {
                <div class="comentario">
                  <app-avatar-membro [membro]="c.quem" [tamanho]="30"></app-avatar-membro>
                  <div class="corpo">
                    <strong>{{ c.quem?.nome ?? 'Alguém do clube' }}</strong>
                    <p>{{ c.texto }}</p>
                  </div>
                  @if (c.autor_id === auth.perfil()?.id || auth.eAdmin()) {
                    <button type="button" class="x" [disabled]="comentando()[chave(r)] || carregandoComentarios()[chave(r)]" (click)="apagarComentario(chave(r), c.id)" aria-label="Apagar comentário">✕</button>
                  }
                </div>
              } @empty {
                @if (!carregandoComentarios()[chave(r)]) { <p class="suave">Ninguém comentou ainda. Comece a conversa!</p> }
              }
              @if (carregandoComentarios()[chave(r)]) { <p role="status">Carregando comentários…</p> }
              @if (maisComentarios()[chave(r)]) {
                <button type="button" class="pilula" [disabled]="carregandoComentarios()[chave(r)]" (click)="carregarComentarios(chave(r), true)">Comentários anteriores</button>
              }
              <div class="novo">
                <input
                  class="campo"
                  type="text"
                  maxlength="1000"
                  placeholder="Escreva um comentário…"
                  [value]="rascunhos()[chave(r)] ?? ''"
                  (input)="digitarComentario(chave(r), $event)"
                  (keyup.enter)="comentar(chave(r))"
                />
                <ion-button size="small" [disabled]="comentando()[chave(r)] || carregandoComentarios()[chave(r)]" (click)="comentar(chave(r))">Enviar</ion-button>
              </div>
            </div>
          }
        </article>
      } @empty {
        @if (!carregando() && !erroDaLista()) {
          <section class="secao vazio">
            <p class="suave">Nenhuma resenha ainda. Que tal ser a primeira? 📚</p>
          </section>
        }
      }
      @if (resenhas().length > 0 && !temMais()) {
        <p class="fim-feed suave" role="status">Você chegou ao fim das resenhas. Toque em Atualizar feed para buscar novas publicações.</p>
      }
      @if (temMais() && !erroDaLista()) {
        <div class="fim-feed"><button type="button" class="pilula" [disabled]="carregando()" (click)="carregarMais()">Carregar mais resenhas</button></div>
      }
      <ion-infinite-scroll threshold="180px" [disabled]="!temMais() || !!erroDaLista()" (ionInfinite)="rolarMais($event)">
        <ion-infinite-scroll-content loadingSpinner="dots" loadingText="Carregando mais resenhas…"></ion-infinite-scroll-content>
      </ion-infinite-scroll>
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
      .origem-resenha { font-size: .78rem; color: var(--cob-vinho); }
      .tipos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
      .fim-feed { text-align: center; padding: 18px; }
      .lista-erro {
        margin: 12px 14px;
      }
    `,
  ],
})
export class ResenhasPage {
  protected readonly auth = inject(AuthService);
  private readonly sb = inject(SupabaseService).cliente;
  private readonly conteudo = viewChild(IonContent);
  protected readonly livros = signal<Livro[]>([]);
  protected readonly resenhas = signal<ResenhaFeed[]>([]);
  protected readonly carregando = signal(false);
  protected readonly temMais = signal(true);
  protected readonly erroDaLista = signal('');
  protected readonly formAberto = signal(false);
  protected readonly origem = signal<Origem>('clube');
  protected readonly livroPessoal = signal<ResultadoBusca | null>(null);
  protected readonly livroId = signal('');
  protected readonly editandoId = signal<string | null>(null);
  protected readonly tituloEdicao = signal('');
  protected readonly preenchendo = signal(false);
  protected readonly nota = signal(0);
  protected readonly dias = signal('');
  protected readonly texto = signal('');
  protected readonly spoiler = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal('');
  protected readonly mensagem = signal('');
  protected readonly abertas = signal<Record<string, boolean>>({});
  protected readonly comentarios = signal<Record<string, Comentario[]>>({});
  protected readonly rascunhos = signal<Record<string, string>>({});
  protected readonly spoilerVisto = signal<Record<string, boolean>>({});
  protected readonly ocupadas = signal<Record<string, boolean>>({});
  protected readonly comentando = signal<Record<string, boolean>>({});
  protected readonly carregandoComentarios = signal<Record<string, boolean>>({});
  protected readonly maisComentarios = signal<Record<string, boolean>>({});
  protected readonly errosInteracao = signal<Record<string, string>>({});
  private cursor: { criado_em: string; id: string; tipo: Origem } | null = null;
  private versao = 0;
  private versaoFicha = 0;

  async ionViewWillEnter() {
    await Promise.all([this.carregarLivros(), this.atualizar()]);
  }
  ionViewWillLeave() { ++this.versao; ++this.versaoFicha; this.carregando.set(false); }

  private async carregarLivros() {
    const { data, error } = await this.sb.from('livros')
      .select('id, titulo, autor, capa_url, criado_em').order('criado_em', { ascending: false });
    if (!error) this.livros.set((data ?? []) as Livro[]);
  }

  protected async atualizar() {
    ++this.versao;
    this.cursor = null;
    this.resenhas.set([]);
    this.abertas.set({});
    this.comentarios.set({});
    this.maisComentarios.set({});
    this.carregandoComentarios.set({});
    this.errosInteracao.set({});
    this.spoilerVisto.set({});
    this.temMais.set(true);
    this.carregando.set(false);
    await this.carregarMais();
  }

  protected async carregarMais() {
    if (this.carregando() || !this.temMais()) return;
    const versao = this.versao;
    this.carregando.set(true);
    this.erroDaLista.set('');
    try {
      const { data, error } = await this.sb.rpc('feed_resenhas', {
        p_antes_data: this.cursor?.criado_em ?? null,
        p_antes_id: this.cursor?.id ?? null,
        p_antes_tipo: this.cursor?.tipo ?? null,
        p_limite: 21,
      });
      if (versao !== this.versao) return;
      if (error) throw error;
      const recebidas = (data ?? []) as ResenhaFeed[];
      const pagina = recebidas.slice(0, 20);
      const vistas = new Set(this.resenhas().map(r => this.chave(r)));
      this.resenhas.update(atuais => [...atuais, ...pagina.filter(r => !vistas.has(this.chave(r)))]);
      if (pagina.length) this.cursor = pagina[pagina.length - 1];
      this.temMais.set(recebidas.length > 20);
    } catch {
      if (versao === this.versao) this.erroDaLista.set('Não consegui carregar o feed agora. Suas resenhas continuam salvas. Tente novamente.');
    } finally {
      if (versao === this.versao) this.carregando.set(false);
    }
  }
  protected async rolarMais(evento: Event) {
    try { await this.carregarMais(); }
    finally { await (evento.target as HTMLIonInfiniteScrollElement).complete(); }
  }

  protected chave(r: ResenhaFeed) { return `${r.tipo}:${r.id}`; }
  private item(chave: string) { return this.resenhas().find(r => this.chave(r) === chave); }
  private tabela(r: ResenhaFeed, recurso: 'resenha' | 'curtida' | 'comentario') {
    if (recurso === 'resenha') return r.tipo === 'clube' ? 'resenhas' : 'resenhas_pessoais';
    if (recurso === 'curtida') return r.tipo === 'clube' ? 'curtidas_resenha' : 'curtidas_resenha_pessoal';
    return r.tipo === 'clube' ? 'comentarios' : 'comentarios_resenha_pessoal';
  }
  private falha(chave: string, texto = '') { this.errosInteracao.update(e => ({ ...e, [chave]: texto })); }
  protected data(iso: string) { return new Date(iso).toLocaleDateString('pt-BR'); }

  protected alternarFormulario() {
    this.formAberto.set(!this.formAberto()); this.erro.set(''); this.mensagem.set('');
  }
  protected trocarOrigem(origem: Origem) {
    if (this.salvando() || origem === this.origem()) return;
    ++this.versaoFicha;
    this.origem.set(origem); this.livroId.set(''); this.editandoId.set(null);
    this.livroPessoal.set(null); this.tituloEdicao.set(''); this.preenchendo.set(false);
    this.nota.set(0); this.dias.set(''); this.texto.set(''); this.spoiler.set(false);
    this.erro.set(''); this.mensagem.set('');
  }
  protected async escolherLivro(evento: Event) {
    await this.preencherPara((evento.target as HTMLSelectElement).value);
  }
  private async preencherPara(id: string) {
    const versao = ++this.versaoFicha;
    this.livroId.set(id); this.editandoId.set(null); this.nota.set(0); this.texto.set('');
    this.dias.set(''); this.spoiler.set(false); this.erro.set('');
    if (!id) { this.preenchendo.set(false); return; }
    this.preenchendo.set(true);
    try {
      const { data, error } = await this.sb.from('resenhas')
        .select('id, nota, dias_leitura, texto, spoiler').eq('livro_id', id)
        .eq('autor_id', this.auth.perfil()!.id).maybeSingle();
      if (versao !== this.versaoFicha) return;
      if (error) { this.erro.set('Não consegui abrir sua ficha. Selecione o livro novamente.'); return; }
      if (data) {
        this.editandoId.set(data.id); this.nota.set(data.nota); this.texto.set(data.texto);
        this.dias.set(data.dias_leitura == null ? '' : String(data.dias_leitura)); this.spoiler.set(data.spoiler);
      }
    } finally { if (versao === this.versaoFicha) this.preenchendo.set(false); }
  }
  protected editar(r: ResenhaFeed) {
    if (this.salvando()) return;
    ++this.versaoFicha;
    this.origem.set(r.tipo); this.formAberto.set(true); this.preenchendo.set(false);
    this.editandoId.set(r.id); this.livroId.set(r.livro_id ?? ''); this.tituloEdicao.set(r.livro?.titulo ?? '');
    this.nota.set(r.nota); this.dias.set(r.dias_leitura == null ? '' : String(r.dias_leitura));
    this.texto.set(r.texto); this.spoiler.set(r.spoiler); this.erro.set(''); this.mensagem.set('');
    // O formulário fica no topo, inclusive quando a resenha veio de uma página antiga.
    void this.conteudo()?.scrollToTop(250);
  }
  protected async salvar() {
    const meuId = this.auth.perfil()?.id;
    if (!meuId || this.salvando() || this.preenchendo()) return;
    this.erro.set(''); this.mensagem.set('');
    const tipo = this.origem(); const id = this.editandoId(); const livro = this.livroPessoal();
    if (tipo === 'clube' && !this.livroId()) return this.erro.set('Escolha o livro.');
    if (tipo === 'pessoal' && !id && !livro) return this.erro.set('Busque e selecione o livro.');
    if (this.nota() < 1 || this.nota() > 5) return this.erro.set('Dê uma nota de 1 a 5 estrelas.');
    if (!this.texto().trim()) return this.erro.set('Conte o que você achou do livro.');
    const dias = this.dias().trim() === '' ? null : Math.min(3650, Math.max(0, Math.round(Number(this.dias()))));
    if (dias !== null && !Number.isFinite(dias)) return this.erro.set('Escreva os dias só com números.');
    this.salvando.set(true);
    try {
      const campos = { nota: this.nota(), texto: this.texto().trim(), spoiler: this.spoiler() };
      const resultado = tipo === 'clube'
        ? await this.sb.from('resenhas').upsert({ ...campos, livro_id: this.livroId(), autor_id: meuId, dias_leitura: dias }, { onConflict: 'livro_id,autor_id' })
        : id
          ? await this.sb.from('resenhas_pessoais').update(campos).eq('id', id).eq('perfil_id', meuId)
          : await this.sb.from('resenhas_pessoais').insert({ ...campos, titulo: livro!.titulo, autor: livro!.autor, capa_url: livro!.capa_url });
      if (resultado.error) {
        this.erro.set(resultado.error.code === '23505' ? 'Você já resenhou esse livro. Abra sua resenha no perfil para editar.' : 'Não deu para salvar a resenha. Tente novamente.'); return;
      }
      this.formAberto.set(false); this.editandoId.set(null); this.livroPessoal.set(null); this.livroId.set('');
      this.texto.set(''); this.nota.set(0); this.dias.set(''); this.spoiler.set(false);
      await this.atualizar();
    } catch { this.erro.set('Não deu para salvar a resenha. Tente novamente.'); }
    finally { this.salvando.set(false); }
  }
  protected async apagar(chave: string) {
    const r = this.item(chave);
    if (!r || this.ocupadas()[chave] || !confirm('Apagar sua resenha?')) return;
    this.ocupadas.update(o => ({ ...o, [chave]: true })); this.falha(chave);
    try {
      const coluna = r.tipo === 'clube' ? 'autor_id' : 'perfil_id';
      const { error } = await this.sb.from(this.tabela(r, 'resenha')).delete().eq('id', r.id).eq(coluna, this.auth.perfil()!.id);
      if (error) throw error;
      this.resenhas.update(rs => rs.filter(item => this.chave(item) !== chave));
    } catch { this.falha(chave, 'Não consegui apagar a resenha. Tente novamente.'); }
    finally { this.ocupadas.update(o => ({ ...o, [chave]: false })); }
  }
  protected mostrarSpoiler(chave: string) { this.spoilerVisto.update(v => ({ ...v, [chave]: true })); }
  protected totalDeCurtidas(chave: string) { return this.item(chave)?.total_curtidas ?? 0; }
  protected euCurti(chave: string) { return this.item(chave)?.eu_curti ?? false; }
  protected async curtir(chave: string) {
    const r = this.item(chave); const meuId = this.auth.perfil()?.id;
    if (!r || !meuId || this.ocupadas()[chave]) return;
    const versao = this.versao;
    this.ocupadas.update(o => ({ ...o, [chave]: true })); this.falha(chave);
    try {
      const tabela = this.tabela(r, 'curtida');
      const { error } = r.eu_curti
        ? await this.sb.from(tabela).delete().eq('resenha_id', r.id).eq('perfil_id', meuId)
        : await this.sb.from(tabela).insert(r.tipo === 'clube' ? { resenha_id: r.id, perfil_id: meuId } : { resenha_id: r.id });
      if (error) throw error;
      if (versao !== this.versao) return;
      this.resenhas.update(rs => rs.map(item => this.chave(item) === chave
        ? { ...item, eu_curti: !r.eu_curti, total_curtidas: Math.max(0, item.total_curtidas + (r.eu_curti ? -1 : 1)) } : item));
    } catch { if (versao === this.versao) this.falha(chave, 'Não consegui salvar sua curtida. Tente novamente.'); }
    finally { this.ocupadas.update(o => ({ ...o, [chave]: false })); }
  }
  protected async alternarComentarios(chave: string) {
    const abrir = !this.abertas()[chave];
    this.abertas.update(a => ({ ...a, [chave]: abrir }));
    if (abrir) await this.carregarComentarios(chave);
  }
  protected async carregarComentarios(chave: string, anteriores = false) {
    const r = this.item(chave);
    if (!r || this.carregandoComentarios()[chave]) return;
    const versao = this.versao;
    this.carregandoComentarios.update(c => ({ ...c, [chave]: true })); this.falha(chave);
    try {
      const atuais = anteriores ? this.comentarios()[chave] ?? [] : [];
      const ultimo = atuais[atuais.length - 1];
      let consulta = this.sb.from(this.tabela(r, 'comentario'))
        .select(`id,resenha_id,autor_id,texto,criado_em,${AUTOR}`).eq('resenha_id', r.id)
        .order('criado_em', { ascending: false }).order('id', { ascending: false }).limit(21);
      if (ultimo) consulta = consulta.or(`criado_em.lt.${ultimo.criado_em},and(criado_em.eq.${ultimo.criado_em},id.lt.${ultimo.id})`);
      const { data, error } = await consulta;
      if (versao !== this.versao) return;
      if (error) throw error;
      const lista = (data ?? []) as unknown as Comentario[];
      this.comentarios.update(c => ({ ...c, [chave]: [...atuais, ...lista.slice(0,20)] }));
      this.maisComentarios.update(c => ({ ...c, [chave]: lista.length > 20 }));
    } catch { if (versao === this.versao) this.falha(chave, 'Não consegui carregar os comentários. Feche e abra os comentários para tentar novamente.'); }
    finally { if (versao === this.versao) this.carregandoComentarios.update(c => ({ ...c, [chave]: false })); }
  }
  protected digitarComentario(chave: string, evento: Event) {
    this.rascunhos.update(r => ({ ...r, [chave]: (evento.target as HTMLInputElement).value }));
  }
  protected async comentar(chave: string) {
    const r = this.item(chave); const meuId = this.auth.perfil()?.id;
    const texto = (this.rascunhos()[chave] ?? '').trim();
    if (!r || !meuId || !texto || texto.length > 1000 || this.comentando()[chave] || this.carregandoComentarios()[chave]) return;
    const versao = this.versao;
    this.comentando.update(c => ({ ...c, [chave]: true })); this.falha(chave);
    try {
      const campos: Record<string, string> = { resenha_id: r.id, texto };
      if (r.tipo === 'clube') campos['autor_id'] = meuId;
      const { error } = await this.sb.from(this.tabela(r, 'comentario')).insert(campos);
      if (versao !== this.versao) return;
      if (error) throw error;
      this.rascunhos.update(rascunhos => ({ ...rascunhos, [chave]: '' }));
      this.resenhas.update(rs => rs.map(item => this.chave(item) === chave ? { ...item, total_comentarios: item.total_comentarios + 1 } : item));
      await this.carregarComentarios(chave);
    } catch { if (versao === this.versao) this.falha(chave, 'Não consegui enviar o comentário. Seu texto continua aqui para tentar novamente.'); }
    finally { this.comentando.update(c => ({ ...c, [chave]: false })); }
  }
  protected async apagarComentario(chave: string, id: string) {
    const r = this.item(chave);
    if (!r || this.comentando()[chave] || this.carregandoComentarios()[chave]) return;
    this.comentando.update(c => ({ ...c, [chave]: true })); this.falha(chave);
    const versao = this.versao;
    try {
      const { error } = await this.sb.from(this.tabela(r, 'comentario')).delete().eq('id', id).eq('resenha_id', r.id);
      if (versao !== this.versao) return;
      if (error) throw error;
      this.comentarios.update(c => ({ ...c, [chave]: (c[chave] ?? []).filter(item => item.id !== id) }));
      this.resenhas.update(rs => rs.map(item => this.chave(item) === chave ? { ...item, total_comentarios: Math.max(0,item.total_comentarios - 1) } : item));
    } catch { if (versao === this.versao) this.falha(chave, 'Não consegui apagar o comentário. Tente novamente.'); }
    finally { this.comentando.update(c => ({ ...c, [chave]: false })); }
  }
}
