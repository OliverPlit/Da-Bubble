import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatDirectMessage } from './chat-direct-message';

describe('ChatDirectMessage', () => {
  let component: ChatDirectMessage;
  let fixture: ComponentFixture<ChatDirectMessage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatDirectMessage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatDirectMessage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
