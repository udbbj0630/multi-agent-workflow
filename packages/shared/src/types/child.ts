export interface Child {
  id: string;
  parentId: string;
  nickname: string;
  birthDate: string; // ISO date
  gender?: 'male' | 'female';
  avatarUrl?: string;
  createdAt: string;
}

export interface Parent {
  id: string;
  phone: string;
  nickname?: string;
  createdAt: string;
}
