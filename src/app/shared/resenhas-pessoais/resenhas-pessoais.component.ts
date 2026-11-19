import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { ResultadoBusca } from '../../core/modelos';
import { BuscaLivroComponent } from '../busca-livro/busca-livro.component';

interface ResenhaPessoal {
  id: string;
  perfil_id: string;
  titulo: string;
  autor: string | null;
  nota: number;
  texto: string;
  spoiler: boolean;
}

@Component({
  selector: 'app-resenhas-pessoais',
  imports: [BuscaLivroComponent],
  template: `
    <section class="secao">
      <h2 class="titulo-serif">Resenhas pessoais</h2>
      @if (proprio()) {
        <form (submit)="salvar($event)">
          @if (!editando()) {
            <app-busca-livro [(escolhido)]="livro" placeholder="Qual livro você quer resenhar?"></app-busca-livro>
          } @else {
            <p>Editando {{ tituloEdicao() }}</p>
          }
          <label>Nota
            <select class="campo" [value]="nota()" (change)="nota.set(+$any($event.target).value)">
              @for (valor of [1,2,3,4,5]; track valor) { <option [value]="valor">{{ valor }} de 5</option> }
            </select>
          </label>
          <label>Sua resenha
            <textarea class="campo" maxlength="5000" rows="4" required [value]="texto()"
              (input)="texto.set($any($event.target).value)"></textarea>
          </label>
          <label class="spoiler"><input type="checkbox" [checked]="spoiler()"
            (change)="spoiler.set($any($event.target).checked)" /> Contém spoilers</label>
          <button class="pilula ativa" type="submit" [disabled]="salvando() || (!livro() && !editando())">Salvar resenha</button>
          @if (editando()) { <button class="pilula" type="button" [disabled]="salvando()" (click)="limpar()">Cancelar edição</button> }
        </form>
      }
      @if (mensagem()) { <p role="status">{{ mensagem() }}</p> }
      @if (carregando()) { <p role="status">Carregando resenhas…</p> }
      @for (resenha of itens(); track resenha.id) {
        <article>
          <h3>{{ resenha.titulo }}</h3>
          <p>{{ resenha.autor }} · {{ resenha.nota }} de 5 estrelas</p>
          @if (resenha.spoiler) {
            <details><summary>Ler resenha com spoilers</summary><p class="texto">{{ resenha.texto }}</p></details>
          } @else { <p class="texto">{{ resenha.texto }}</p> }
          @if (proprio()) {
            <button type="button" class="pilula" [disabled]="salvando()" (click)="editar(resenha)">Editar</button>
            <button type="button" class="pilula" [disabled]="salvando()" (click)="excluir(resenha.id)">Excluir</button>
          }
        </article>
      } @empty { @if (!carregando()) { <p class="suave">Nenhuma resenha pessoal publicada.</p> } }
    </section>
  `,
  styles: [`
    form,label { display: grid; gap: 8px; } form { margin-bottom: 20px; }
    .spoiler { display: flex; align-items: center; }
    article { border-top: 1px solid #e7bbc6; padding: 14px 0; }
    h3 { margin: 0; } .texto { white-space: pre-wrap; overflow-wrap: anywhere; }
  `],
})
export class ResenhasPessoaisComponent {
  readonly perfilId = input.required<string>();
  private readonly sb = inject(SupabaseService).cliente;
  private readonly auth = inject(AuthService);
  protected readonly proprio = computed(() => this.auth.perfil()?.id === this.perfilId());
  protected readonly itens = signal<ResenhaPessoal[]>([]);
  protected readonly livro = signal<ResultadoBusca | null>(null);
  protected readonly nota = signal(5);
  protected readonly texto = signal('');
  protected readonly spoiler = signal(false);
  protected readonly editando = signal<string | null>(null);
  protected readonly tituloEdicao = signal('');
  protected readonly mensagem = signal('');
  protected readonly carregando = signal(false);
  protected readonly salvando = signal(false);
  private versao = 0;

  constructor() {
    effect(() => {
      const id = this.perfilId();
      untracked(() => { this.limpar(); void this.carregar(id); });
    });
  }

  private async carregar(id = this.perfilId()) {
    const versao = ++this.versao;
    this.carregando.set(true);
    this.itens.set([]);
    const { data, error } = await this.sb.from('resenhas_pessoais')
      .select('id, perfil_id, titulo, autor, nota, texto, spoiler')
      .eq('perfil_id', id).order('criado_em', { ascending: false });
    if (versao !== this.versao) return;
    this.itens.set((data ?? []) as ResenhaPessoal[]);
    this.carregando.set(false);
    if (error) this.mensagem.set('Não consegui carregar as resenhas.');
  }

  protected editar(resenha: ResenhaPessoal) {
    this.editando.set(resenha.id);
    this.tituloEdicao.set(resenha.titulo);
    this.nota.set(resenha.nota);
    this.texto.set(resenha.texto);
    this.spoiler.set(resenha.spoiler);
  }

  protected limpar() {
    this.editando.set(null);
    this.tituloEdicao.set('');
    this.texto.set('');
    this.nota.set(5);
    this.spoiler.set(false);
  }

  protected async salvar(evento: Event) {
    evento.preventDefault();
    if (!this.proprio() || this.salvando() || !this.texto().trim()) return;
    const livro = this.livro();
    const id = this.editando();
    if (!id && !livro) return;
    const perfilId = this.perfilId();
    this.salvando.set(true);
    this.mensagem.set('');
    try {
      const campos = { nota: this.nota(), texto: this.texto().trim(), spoiler: this.spoiler() };
      const { error } = id
        ? await this.sb.from('resenhas_pessoais').update(campos).eq('id', id).eq('perfil_id', perfilId)
        : await this.sb.from('resenhas_pessoais').insert({
          ...campos, titulo: livro!.titulo, autor: livro!.autor, capa_url: livro!.capa_url,
        });
      if (perfilId !== this.perfilId()) return;
      if (error) {
        this.mensagem.set(error.code === '23505'
          ? 'Você já resenhou esse livro. Use Editar na resenha existente.' : 'Não consegui salvar a resenha.');
        return;
      }
      this.limpar();
      await this.carregar();
      this.mensagem.set('Resenha salva.');
    } finally { this.salvando.set(false); }
  }

  protected async excluir(id: string) {
    if (!this.proprio() || this.salvando()) return;
    if (!window.confirm('Excluir esta resenha pessoal?')) return;
    this.salvando.set(true);
    try {
      const { error } = await this.sb.from('resenhas_pessoais').delete()
        .eq('id', id).eq('perfil_id', this.perfilId());
      if (error) this.mensagem.set('Não consegui excluir a resenha.');
      else await this.carregar();
    } finally { this.salvando.set(false); }
  }
}
