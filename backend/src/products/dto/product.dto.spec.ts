import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto, UpdateProductDto } from './product.dto';

describe('Product promotion DTO shape', () => {
  const baseCreate = {
    name: 'Test Product',
    sku: 'SKU-001',
    costPrice: 100,
    salePrice: 19900,
    stock: 10,
    minStock: 5,
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
  };

  it('accepts a valid promotion payload', async () => {
    const dto = plainToInstance(CreateProductDto, {
      ...baseCreate,
      promotionType: 'PERCENTAGE',
      promotionValue: 15,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a non-number promotionValue', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      promotionValue: 'half-price',
    });

    const errors = await validate(dto);

    const valueErrors = errors.find((e) => e.property === 'promotionValue');
    expect(valueErrors).toBeDefined();
    expect(valueErrors!.constraints).toHaveProperty('isNumber');
  });

  it('rejects a negative promotionValue', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      promotionValue: -5,
    });

    const errors = await validate(dto);

    const valueErrors = errors.find((e) => e.property === 'promotionValue');
    expect(valueErrors).toBeDefined();
    expect(valueErrors!.constraints).toHaveProperty('min');
  });

  it('rejects an unknown promotionType', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      promotionType: 'BUY_ONE_GET_ONE',
    });

    const errors = await validate(dto);

    const typeErrors = errors.find((e) => e.property === 'promotionType');
    expect(typeErrors).toBeDefined();
    expect(typeErrors!.constraints).toHaveProperty('isEnum');
  });

  it('lets an explicit null pass for clearing the promotion', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      promotionType: null,
      promotionValue: null,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.promotionType).toBeNull();
    expect(dto.promotionValue).toBeNull();
  });
});
