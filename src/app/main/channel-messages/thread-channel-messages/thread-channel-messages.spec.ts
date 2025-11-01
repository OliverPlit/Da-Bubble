import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreadChannelMessages } from './thread-channel-messages';

describe('ThreadChannelMessages', () => {
  let component: ThreadChannelMessages;
  let fixture: ComponentFixture<ThreadChannelMessages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreadChannelMessages]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreadChannelMessages);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
