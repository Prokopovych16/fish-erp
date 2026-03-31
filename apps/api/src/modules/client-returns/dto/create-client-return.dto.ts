export class CreateClientReturnDto {
  clientId: string;
  deliveryPointId: string;
  note?: string;
  items: {
    productId: string;
    totalQty: number;
    goodQty: number;
    warehouseId: string;
  }[];
}