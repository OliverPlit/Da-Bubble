import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelMessagesHeader } from './channel-messages-header';

describe('ChannelMessagesHeader', () => {
  let component: ChannelMessagesHeader;
  let fixture: ComponentFixture<ChannelMessagesHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelMessagesHeader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChannelMessagesHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
