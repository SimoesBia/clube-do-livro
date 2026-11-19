import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonSegment, IonSegmentButton, IonLabel,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { AvatarSeletorComponent } from '../../shared/avatar/avatar-seletor.component';
import { ResenhasPessoaisComponent } from '../../shared/resenhas-pessoais/resenhas-pessoais.component';
import { ConversasComponent } from '../../shared/conversas/conversas.component';
import { LivrosLidosComponent } from '../../shared/livros-lidos/livros-lidos.component';

@Component({
  selector: 'app-perfil',
  imports: [
    IonSegment, IonSegmentButton, IonLabel,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
    AvatarSeletorComponent,
    LivrosLidosComponent, ResenhasPessoaisComponent, ConversasComponent,
  ],
  templateUrl: './perfil.page.html',
  styleUrl: './perfil.page.scss',
})
export class PerfilPage {
  protected readonly aba = signal('estante');
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastController);

  protected readonly email = computed(() => this.auth.sessao()?.user.email ?? '');
  protected readonly nome = signal('');
  protected readonly aniversario = signal('');
  protected readonly avatarId = signal<string | null>(null);
  protected readonly receberEmails = signal(true);
  protected readonly salvando = signal(false);
  protected readonly erro = signal('');

  protected readonly hoje = new Date().toISOString().slice(0, 10);

  // Toda vez que a tela abre, carrega os dados atuais da pessoa
  ionViewWillEnter() {
    const p = this.auth.perfil();
    if (!p) return;
    this.receberEmails.set(p.receber_emails ?? true);
    this.nome.set(p.nome);
    this.aniversario.set(p.aniversario ?? '');
    this.avatarId.set(p.avatar_id);
    this.erro.set('');
  }

  protected digitar(campo: WritableSignal<string>, evento: Event) {
    campo.set(String((evento as CustomEvent).detail.value ?? ''));
  }

  protected async salvar() {
    this.erro.set('');
    if (this.nome().trim().length < 2) {
      this.erro.set('Conte pra gente o seu nome.');
      return;
    }
    if (!this.avatarId()) {
      this.erro.set('Escolha um avatar.');
      return;
    }
    this.salvando.set(true);
    const resultado = await this.auth.atualizarPerfil({
      receber_emails: this.receberEmails(),
      nome: this.nome().trim(),
      aniversario: this.aniversario() || null,
      avatar_id: this.avatarId(),
    });
    this.salvando.set(false);

    if (resultado.erro) {
      this.erro.set(resultado.erro);
      return;
    }
    const aviso = await this.toasts.create({
      message: 'Perfil salvo!',
      duration: 2000,
      color: 'primary',
      position: 'bottom',
    });
    await aviso.present();
  }

  protected async sair() {
    await this.auth.sair();
    await this.router.navigateByUrl('/entrar', { replaceUrl: true });
  }
}
