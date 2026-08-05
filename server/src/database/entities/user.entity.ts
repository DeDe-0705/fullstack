import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

// 与 server/sql/agent-demo-init.sql 中的 users 表保持一致
@Entity('users')
export class User {
  // MySQL BIGINT 在 JS 里返回 string，演示数据量远达不到精度上限，直接用 string 透传
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @OneToMany(() => Conversation, (conversation) => conversation.user)
  conversations!: Conversation[];
}
