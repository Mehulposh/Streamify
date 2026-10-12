import { useState } from "react";
import { Copy, ListPlus, Plus, Send } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { useToast } from "../context/ToastContext";
import { Button, Empty, Input, Modal, Spinner, Textarea } from "./ui";

/** Add a title to one of the profile's custom lists (or create a new list on the spot). */
export function AddToListModal({ open, onClose, item }) {
  const toast = useToast(); const { data, loading, reload } = useFetch(() => (open ? api.get("/lists") : Promise.resolve({ data: { lists: [] } })), [open]);
  const [name, setName] = useState("");
  const payload = { tmdbId: item.id, mediaType: item.mediaType, title: item.title, poster_path: item.poster_path || null, vote_average: item.vote_average || 0 };
  const add = async (list) => { try { await api.post(`/lists/${list._id}/items`, payload); toast(`Added to “${list.name}”`); onClose(); } catch (e) { toast(errMsg(e), e.response?.status === 409 ? "info" : "error"); } };
  const create = async (e) => {
    e.preventDefault();
    try { const { data: d } = await api.post("/lists", { name }); await api.post(`/lists/${d.list._id}/items`, payload); toast(`Created “${name}”`); setName(""); reload(true); onClose(); } catch (err) { toast(errMsg(err), "error"); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add to list">
      {loading ? <Spinner className="!py-6" /> : (
        <div className="space-y-3">
          {!data?.lists?.length ? <Empty icon={ListPlus} title="No lists yet" text="Create your first list below." /> : (
            <div className="max-h-60 space-y-2 overflow-y-auto">{data.lists.map((l) => (
              <button key={l._id} onClick={() => add(l)} className="glass flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-fuchsia-500/10">
                <span className="truncate">{l.name}</span><span className="text-xs text-slate-500">{l.itemCount} titles</span></button>))}</div>)}
          <form onSubmit={create} className="flex gap-2"><Input required maxLength={60} placeholder="New list name" value={name} onChange={(e) => setName(e.target.value)} /><Button><Plus size={16} /> Create</Button></form>
        </div>)}
    </Modal>
  );
}

/** Share a title with someone you follow (they get a notification). */
export function ShareModal({ open, onClose, item }) {
  const toast = useToast(); const { data, loading } = useFetch(() => (open ? api.get("/social/following") : Promise.resolve({ data: { users: [] } })), [open]);
  const [msg, setMsg] = useState("");
  const send = async (username) => {
    try { await api.post("/social/share", { username, tmdbId: item.id, mediaType: item.mediaType, title: item.title, message: msg }); toast(`Sent to ${username}`); onClose(); }
    catch (e) { toast(errMsg(e), "error"); }
  };
  const link = `${window.location.origin}/title/${item.mediaType}/${item.id}`;
  return (
    <Modal open={open} onClose={onClose} title={`Share “${item.title}”`}>
      <div className="space-y-4">
        <div className="flex gap-2"><Input readOnly value={link} onFocus={(e) => e.target.select()} /><Button variant="ghost" onClick={() => { navigator.clipboard.writeText(link); toast("Link copied"); }}><Copy size={16} /></Button></div>
        <Textarea rows={2} maxLength={200} placeholder="Add a message (optional)" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <p className="label !mb-0">Send to a friend</p>
        {loading ? <Spinner className="!py-4" /> : !data?.users?.length ? <p className="text-sm text-slate-500">Follow people in Friends to share titles with them.</p> : (
          <div className="max-h-48 space-y-2 overflow-y-auto">{data.users.map((u) => (
            <div key={u.username} className="glass flex items-center justify-between rounded-xl px-4 py-2.5"><span className="text-sm font-semibold">{u.username}</span>
              <Button size="sm" variant="soft" onClick={() => send(u.username)}><Send size={14} /> Send</Button></div>))}</div>)}
      </div>
    </Modal>
  );
}
