import { Test, TestingModule } from '@nestjs/testing';
import { AccountantService } from './accountant.service';

describe('AccountantService', () => {
  let service: AccountantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountantService],
    }).compile();

    service = module.get<AccountantService>(AccountantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
