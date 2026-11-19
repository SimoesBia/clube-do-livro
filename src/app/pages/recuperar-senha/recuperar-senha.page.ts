import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-recuperar-senha',
  imports: [IonContent, RouterLink],
  template: `
    <ion-content>
      <main class="secao">
        <h1 class="titulo-serif">{{ redefinir ? 'Definir nova senha' : 'Esqueci minha senha' }}</h1>
        @if (iniciando()) { <p>Conferindo o link…</p> }
        <form (submit)="enviar($event)">
          @if (!redefinir) {
            <label>E-mail da conta<input class="campo" type="email" required autocomplete="email"
              [value]="email()" (input)="email.set($any($event.target).value)" /></label>
          } @else {
            <label>Nova senha<input class="campo" type="password" required minlength="6" autocomplete="new-password"
              [value]="senha()" (input)="senha.set($any($event.target).value)" /></label>
            <label>Repita a nova senha<input class="campo" type="password" required minlength="6" autocomplete="new-password"
              [value]="confirmacao()" (input)="confirmacao.set($any($event.target).value)" /></label>
          }
          <button class="pilula ativa" [disabled]="ocupado() || iniciando() || (redefinir && !linkValido())">
            {{ ocupado() ? 'Aguarde…' : redefinir ? 'Salvar nova senha' : 'Receber link por e-mail' }}
          </button>
        </form>
        @if (mensagem()) { <p role="status">{{ mensagem() }}</p> }
        @if (redefinir) { <p><a routerLink="/recuperar-senha">Pedir outro link</a></p> }
        <p><a routerLink="/entrar">Voltar para entrar</a></p>
      </main>
    </ion-content>
  `,
  styles: [`
    main { max-width: 450px; margin: 30px auto; } form,label { display:grid; gap:12px; }
  `],
})
export class RecuperarSenhaPage implements OnInit {
  private readonly sb = inject(SupabaseService).cliente;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly redefinir = this.router.url.startsWith('/redefinir-senha');
  protected readonly email = signal('');
  protected readonly senha = signal('');
  protected readonly confirmacao = signal('');
  protected readonly ocupado = signal(false);
  protected readonly iniciando = signal(true);
  protected readonly linkValido = signal(false);
  protected readonly mensagem = signal('');

  async ngOnInit() {
    await this.auth.pronto;
    if (this.redefinir) {
      const { data, error } = await this.sb.auth.getSession();
      this.linkValido.set(!error && !!data.session);
      if (!data.session) this.mensagem.set('Este link expirou ou não pôde ser confirmado. Peça outro link abaixo.');
    }
    this.iniciando.set(false);
  }

  protected async enviar(evento: Event) {
    evento.preventDefault();
    if (this.ocupado()) return;
    if (this.redefinir && (!this.linkValido() || this.senha().length < 6 || this.senha() !== this.confirmacao())) {
      this.mensagem.set('As duas senhas devem ser iguais e ter pelo menos 6 caracteres.');
      return;
    }
    this.ocupado.set(true);
    try {
      if (this.redefinir) {
        const { error } = await this.sb.auth.updateUser({ password: this.senha() });
        if (error) { this.mensagem.set('Não consegui atualizar a senha. Peça outro link ou tente uma senha diferente.'); return; }
        await this.auth.sair();
        await this.router.navigateByUrl('/entrar', { replaceUrl: true });
      } else {
        const { error } = await this.sb.auth.resetPasswordForEmail(this.email().trim(), {
          redirectTo: window.location.origin + '/redefinir-senha',
        });
        this.mensagem.set(error ? 'Não consegui enviar agora. Aguarde um pouco e tente novamente.'
          : 'Se esse e-mail tiver uma conta, você receberá um link para redefinir a senha. Confira também o spam.');
      }
    } catch { this.mensagem.set('Falha de conexão. Tente novamente.'); }
    finally { this.ocupado.set(false); }
  }
}
