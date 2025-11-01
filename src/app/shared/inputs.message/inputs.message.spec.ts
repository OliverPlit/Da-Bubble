import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputsMessage } from './inputs.message';

describe('InputsMessage', () => {
  let component: InputsMessage;
  let fixture: ComponentFixture<InputsMessage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputsMessage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputsMessage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
