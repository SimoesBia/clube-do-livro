import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { LivroLido, STATUS_LEITURA, StatusLeitura } from '../../core/modelos';
import { ResenhasPessoaisComponent } from '../../shared/resenhas-pessoais/resenhas-pessoais.component';
import { ChatPrivadoComponent } from '../../shared/chat-privado/chat-privado.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { DetalheLivroComponent } from '../../shared/detalhe-livro/detalhe-livro.component';
import { ResultadoBusca } from '../../core/modelos';

@Component({
  selector: 'app-perfil-membro',
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel,
    ResenhasPessoaisComponent, ChatPrivadoComponent, AvatarComponent, DetalheLivroComponent],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/app/inicio" text="Voltar"></ion-back-button></ion-buttons>
      <ion-title>{{ nome() }}</ion-title>
    </ion-toolbar></ion-header>
    <ion-content>
      <section class="secao">
        <app-avatar [avatarId]="avatar()" [tamanho]="80"></app-avatar>
        <h1 class="titulo-serif">{{ nome() }}</h1>
        <p>{{ totalLidos() }} livros lidos · {{ paginas() }} páginas</p>
        @if (id() !== auth.perfil()?.id) {
          <button class="pilula" type="button" (click)="chat.set(!chat())">Enviar mensagem</button>
          @if (chat()) { <app-chat-privado [destinatario]="id()" [nome]="nome()"></app-chat-privado> }
        }
      </section>
      <ion-segment [value]="aba()" (ionChange)="aba.set($any($event).detail.value)">
        <ion-segment-button value="estante"><ion-label>Estante</ion-label></ion-segment-button>
        <ion-segment-button value="resenhas"><ion-label>Resenhas</ion-label></ion-segment-button>
      </ion-segment>
      @if (aba() === 'estante') {
        <section class="secao">
          <div class="filtros">
            @for (status of statusLeitura; track status.valor) {
              <button class="pilula" type="button" [class.ativa]="filtro() === status.valor" (click)="filtro.set(status.valor)">{{ status.nome }}</button>
            }
          </div>
          @if (erro()) { <p role="status">{{ erro() }}</p> }
          @if (carregando()) { <p>Carregando estante…</p> }
          @for (livro of filtrados(); track livro.id) {
            <button class="livro" type="button" (click)="detalhe.set(livro)">
              @if (livro.capa_url) { <img [src]="livro.capa_url" alt="" loading="lazy" /> }
              <span><strong>{{ livro.titulo }}</strong><br />{{ livro.autor }}</span>
            </button>
          } @empty { @if (!carregando()) { <p class="suave">Nenhum livro nesta lista.</p> } }
        </section>
      } @else {
        <app-resenhas-pessoais [perfilId]="id()"></app-resenhas-pessoais>
        <section class="secao">
          <h2 class="titulo-serif">Resenhas do clube</h2>
          @for (resenha of resenhasClube(); track resenha.id) {
            <article>
              <h3>{{ resenha.livro?.titulo ?? 'Livro do clube' }} · {{ resenha.nota }} de 5</h3>
              @if (resenha.spoiler) {
                <details><summary>Ler resenha com spoilers</summary><p class="texto">{{ resenha.texto }}</p></details>
              } @else { <p class="texto">{{ resenha.texto }}</p> }
            </article>
          } @empty { <p class="suave">Nenhuma resenha do clube publicada.</p> }
        </section>
      }
      <app-detalhe-livro [livro]="detalhe()" modo="perfil" (fechar)="detalhe.set(null)"></app-detalhe-livro>
    </ion-content>
  `,
  styles: [`
    .filtros { display: flex; flex-wrap: wrap; gap: 6px; }
    .livro { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
      background: transparent; color: inherit; font: inherit; border: 0; padding: 12px 0; }
    img { width: 40px; height: 60px; object-fit: cover; }
    article { border-bottom: 1px solid #e7bbc6; padding: 12px 0; } .texto { white-space: pre-wrap; overflow-wrap: anywhere; }
  `],
})
export class PerfilMembroPage {
  readonly id = input.required<string>();
  protected readonly auth = inject(AuthService);
  private readonly sb = inject(SupabaseService).cliente;
  protected readonly nome = signal('Perfil da integrante');
  protected readonly avatar = signal<string | null>(null);
  protected readonly livros = signal<LivroLido[]>([]);
  protected readonly aba = signal('estante');
  protected readonly chat = signal(false);
  protected readonly filtro = signal<StatusLeitura>('lido');
  protected readonly statusLeitura = STATUS_LEITURA;
  protected readonly erro = signal('');
  protected readonly carregando = signal(false);
  protected readonly detalhe = signal<ResultadoBusca | null>(null);
  protected readonly resenhasClube = signal<{id:string; nota:number; texto:string; spoiler:boolean; livro:{titulo:string} | null}[]>([]);
  protected readonly filtrados = computed(() => this.livros().filter(l => l.status_leitura === this.filtro()));
  protected readonly totalLidos = computed(() => this.livros().filter(l => l.status_leitura === 'lido').length);
  protected readonly paginas = computed(() => this.livros().filter(l => l.status_leitura === 'lido').reduce((n,l) => n + (l.paginas ?? 0),0));
  private versao = 0;

  constructor() {
    effect(() => { const id = this.id(); untracked(() => void this.carregar(id)); });
  }
  ionViewWillLeave() { this.chat.set(false); }

  private async carregar(id: string) {
    const versao = ++this.versao;
    this.chat.set(false);
    this.livros.set([]);
    this.resenhasClube.set([]);
    this.erro.set('');
    if (!/^[0-9a-f-]{36}$/i.test(id)) { this.erro.set('Perfil inválido.'); return; }
    this.carregando.set(true);
    const [perfil, livros, resenhas] = await Promise.all([
      this.sb.from('perfis').select('nome,avatar_id').eq('id',id).maybeSingle(),
      this.sb.from('livros_lidos').select('*').eq('perfil_id',id).order('criado_em',{ascending:false}),
      this.sb.from('resenhas').select('id,nota,texto,spoiler,livro:livros!livro_id(titulo)')
        .eq('autor_id',id).order('criado_em',{ascending:false}),
    ]);
    if (versao !== this.versao) return;
    this.carregando.set(false);
    this.nome.set(perfil.data?.nome ?? 'Integrante');
    this.avatar.set(perfil.data?.avatar_id ?? null);
    this.livros.set((livros.data ?? []) as LivroLido[]);
    this.resenhasClube.set((resenhas.data ?? []) as unknown as ReturnType<typeof this.resenhasClube>);
    if (perfil.error || livros.error || resenhas.error) this.erro.set('Não consegui carregar todos os dados do perfil.');
  }
}
