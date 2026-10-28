import { Component, WritableSignal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { AvatarSeletorComponent } from '../../shared/avatar/avatar-seletor.component';

type Modo = 'entrar' | 'criar';

@Component({
  selector: 'app-login',
  imports: [
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonSpinner,
    AvatarSeletorComponent,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Estado da tela
  protected readonly modo = signal<Modo>('entrar');
  protected readonly passo = signal<1 | 2>(1);
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');
  protected readonly aviso = signal('');

  // Campos do formulário
  protected readonly nome = signal('');
  protected readonly aniversario = signal('');
  protected readonly email = signal('');
  protected readonly senha = signal('');
  protected readonly avatarId = signal<string | null>(null);

  protected readonly hoje = new Date().toISOString().slice(0, 10);

  protected trocarModo(evento: Event) {
    this.modo.set((evento as CustomEvent).detail.value as Modo);
    this.passo.set(1);
    this.erro.set('');
    this.aviso.set('');
  }

  // Guarda o que a pessoa digita dentro do "signal" do campo
  protected digitar(campo: WritableSignal<string>, evento: Event) {
    campo.set(String((evento as CustomEvent).detail.value ?? ''));
  }

  protected async entrar() {
    this.erro.set('');
    if (!this.email().trim() || !this.senha()) {
      this.erro.set('Preencha o e-mail e a senha.');
      return;
    }
    this.carregando.set(true);
    const resultado = await this.auth.entrar(this.email(), this.senha());
    this.carregando.set(false);

    if (resultado.erro) {
      this.erro.set(resultado.erro);
      return;
    }
    await this.router.navigateByUrl('/app/inicio', { replaceUrl: true });
  }

  protected continuar() {
    this.erro.set('');
    const problema = this.validarDados();
    if (problema) {
      this.erro.set(problema);
      return;
    }
    this.passo.set(2);
  }

  protected voltar() {
    this.erro.set('');
    this.passo.set(1);
  }

  protected async criarConta() {
    this.erro.set('');
    this.aviso.set('');
    if (!this.avatarId()) {
      this.erro.set('Escolha um avatar para continuar.');
      return;
    }
    this.carregando.set(true);
    const resultado = await this.auth.criarConta({
      nome: this.nome(),
      aniversario: this.aniversario(),
      email: this.email(),
      senha: this.senha(),
      avatarId: this.avatarId() ?? '',
    });
    this.carregando.set(false);

    if (resultado.erro) {
      this.erro.set(resultado.erro);
      return;
    }
    if (resultado.precisaConfirmar) {
      this.aviso.set('Conta criada! Abra o e-mail que enviamos, confirme e depois volte para entrar.');
      return;
    }
    await this.router.navigateByUrl('/app/inicio', { replaceUrl: true });
  }

  private validarDados(): string {
    if (this.nome().trim().length < 2) return 'Conte pra gente o seu nome.';
    if (!this.aniversario()) return 'Informe a data do seu aniversário.';
    if (!/^\S+@\S+\.\S+$/.test(this.email().trim())) return 'Esse e-mail não parece válido.';
    if (this.senha().length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
    return '';
  }
}
