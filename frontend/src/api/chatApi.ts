import { client } from './client';

export const MAX_QUESTION_LENGTH = 500;

export const askAssistant = async (question: string) => {
  const { data } = await client.post<{ answer: string }>('/chat', { question });
  return data.answer;
};
