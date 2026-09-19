import { RoomPage } from "@/components/room-page";
export default async function RoomRoute({ params }: { params: Promise<{ roomId: string }> }) { const { roomId } = await params; return <RoomPage roomId={roomId} />; }
