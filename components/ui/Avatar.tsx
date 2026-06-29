import { ini } from '@/lib/utils'

interface AvatarProps {
  nama: string
  size?: 'sm' | 'md'
}

export default function Avatar({ nama, size = 'md' }: AvatarProps) {
  const dim = size === 'sm' ? 'w-[30px] h-[30px] text-[11px]' : 'w-9 h-9 text-[13px]'
  return (
    <div className={`${dim} rounded-full bg-blue-light flex items-center justify-center font-semibold text-blue-dark flex-shrink-0`}>
      {ini(nama)}
    </div>
  )
}
