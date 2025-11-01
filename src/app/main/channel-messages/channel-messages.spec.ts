import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelMessages } from './channel-messages';

describe('ChannelMessages', () => {
  let component: ChannelMessages;
  let fixture: ComponentFixture<ChannelMessages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelMessages]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChannelMessages);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
