import { client } from './client';

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: 'email' | 'push';
  event: string;
  isRead: boolean;
  sentAt?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const getMyNotifications = async (page = 1) => {
  const { data } = await client.get<NotificationsResponse>('/notifications/mine', {
    params: { page, limit: 10 },
  });
  return data;
};

export const markNotificationRead = async (id: string) => {
  const { data } = await client.patch<{ notification: AppNotification }>(
    `/notifications/${id}/read`
  );
  return data.notification;
};
