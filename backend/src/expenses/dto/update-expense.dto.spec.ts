import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateExpenseDto } from './update-expense.dto';

describe('UpdateExpenseDto', () => {
  it('allows null to clear supplierId, purchaseOrderId and description', async () => {
    const dto = plainToInstance(UpdateExpenseDto, {
      supplierId: null,
      purchaseOrderId: null,
      description: null,
    });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });

  it('rejects a non-UUID supplierId', async () => {
    const dto = plainToInstance(UpdateExpenseDto, { supplierId: 'no-uuid' });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-UUID purchaseOrderId', async () => {
    const dto = plainToInstance(UpdateExpenseDto, {
      purchaseOrderId: 'no-uuid',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
