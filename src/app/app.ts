import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Main } from "./main/main";
import { LandingPage } from "./landing-page/landing-page";


@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Da-Bubble');
}
