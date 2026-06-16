import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CartItemEntity } from './cart-item.entity';
import { CartStatuses } from '../models';

@Entity({ name: 'carts' })
export class CartEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', nullable: false })
  userId!: string;

  @Column({
    type: 'enum',
    enum: CartStatuses,
    default: CartStatuses.OPEN,
  })
  status!: CartStatuses;

  @OneToMany(() => CartItemEntity, (item) => item.cart, {
    // Saving a Cart will automatically save its CartItems
    // Removing a cart will remove its items
    cascade: true,
    // no eager: true since it is unnecessary db load and lost control over the queries
  })
  items!: CartItemEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
