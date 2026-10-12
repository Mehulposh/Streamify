import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, Globe, ListVideo, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import api, { errMsg, img } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { useToast } from "../context/ToastContext";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Switch, Textarea } from "../components/ui";
import PosterCard from "../components/PosterCard";
import ThemeToggle from "../components/ThemeToggle";

const Mosaic = ({ items }) => (
  <div className="grid h-36 grid-cols-4 overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-600/20">
    {[0, 1, 2, 3].map((i) => items[i]?.poster_path ? <img key={i} src={img(items[i].poster_path, "w185")} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div key={i} className="bg-black/5 dark:bg-white/5" />)}
  </div>
);
const toCard = (i) => ({ ...i, id: i.tmdbId });

export function ListsPage() {
  const toast = useToast(); const nav = useNavigate(); const { data, loading, error, reload } = useFetch(() => api.get("/lists"), []);
  const [open, setOpen] = useState(false); const [f, setF] = useState({ name: "", description: "", isPublic: false });
  const create = async (e) => { e.preventDefault(); try { const { data: d } = await api.post("/lists", f); toast("List created"); setOpen(false); nav(`/lists/${d.list._id}`); } catch (err) { toast(errMsg(err), "error"); } };
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="My lists" subtitle="Collections like “Weekend picks”. Make one public to share it." action={<Button onClick={() => setOpen(true)}><Plus size={16} /> New list</Button>} />
      {!data.lists.length ? <Card><Empty icon={ListVideo} title="No lists yet" text="Create a list, then add titles from any details page." action={<Button className="mt-3" onClick={() => setOpen(true)}>Create your first list</Button>} /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.lists.map((l) => (
          <Link key={l._id} to={`/lists/${l._id}`}><Card className="space-y-3 !p-3 transition hover:-translate-y-1"><Mosaic items={l.items} />
            <div className="px-1 pb-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-bold">{l.name}</p>{l.isPublic ? <Badge tone="emerald"><Globe size={11} /> Public</Badge> : <Badge><Lock size={11} /> Private</Badge>}</div><p className="text-xs opacity-60">{l.itemCount} titles</p></div></Card></Link>))}</div>)}
      <Modal open={open} onClose={() => setOpen(false)} title="New list">
        <form onSubmit={create} className="space-y-4"><Field label="Name"><Input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Switch checked={f.isPublic} onChange={(v) => setF({ ...f, isPublic: v })} label="Public (anyone with the link can view)" /><Button className="w-full">Create</Button></form>
      </Modal>
    </>
  );
}

export function ListDetail() {
  const { id } = useParams(); const toast = useToast(); const nav = useNavigate();
  const { data, loading, error, reload } = useFetch(() => api.get(`/lists/${id}`), [id]);
  const [edit, setEdit] = useState(null);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  const l = data.list, link = l.shareId ? `${window.location.origin}/lists/shared/${l.shareId}` : "";
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <>
      <PageHeader title={l.name} subtitle={l.description || `${l.items.length} titles`} action={
        <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={() => setEdit({ name: l.name, description: l.description })}><Pencil size={14} /> Edit</Button>
          <Button variant="ghost" size="sm" className="!text-rose-500" onClick={async () => { if (window.confirm("Delete this list?")) { await run(() => api.delete(`/lists/${id}`)); nav("/lists"); } }}><Trash2 size={14} /> Delete</Button></div>} />
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 !p-4">
        <Switch checked={l.isPublic} onChange={(v) => run(() => api.patch(`/lists/${id}`, { isPublic: v }), v ? "List is now public" : "List is private")} label={l.isPublic ? "Public: anyone with the link can view" : "Private"} />
        {link && <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md"><Input readOnly value={link} onFocus={(e) => e.target.select()} /><Button variant="ghost" onClick={() => { navigator.clipboard.writeText(link); toast("Link copied"); }}><Copy size={16} /></Button></div>}
      </Card>
      {!l.items.length ? <Card><Empty icon={ListVideo} title="This list is empty" text="Open a title and choose “Add to list”." /></Card> : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">{l.items.map((i) => (
          <div key={`${i.mediaType}-${i.tmdbId}`} className="relative">
            <PosterCard item={toCard(i)} type={i.mediaType} className="w-full" />
            <button aria-label="Remove from list" onClick={() => run(() => api.delete(`/lists/${id}/items/${i.mediaType}/${i.tmdbId}`))} className="glass absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full text-rose-500"><X size={14} /></button>
          </div>))}</div>)}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit list">{edit && (
        <div className="space-y-4"><Field label="Name"><Input maxLength={60} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field><Field label="Description"><Textarea rows={2} maxLength={300} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit.name.trim()} onClick={() => run(() => api.patch(`/lists/${id}`, edit), "List updated").then(() => setEdit(null))}>Save</Button></div></div>)}</Modal>
    </>
  );
}

/** Public page (no login needed): /lists/shared/:shareId */
export function SharedList() {
  const { shareId } = useParams(); const { data, loading, error } = useFetch(() => api.get(`/lists/shared/${shareId}`), [shareId]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between"><Link to="/" className="text-lg font-black">Stream<span className="gradient-text">ify</span></Link><div className="flex items-center gap-2"><ThemeToggle /><Link to="/register"><Button size="sm">Join free</Button></Link></div></header>
      {loading ? <Spinner /> : error ? <ErrorBox message="This list does not exist or is no longer public." /> : (
        <>
          <h1 className="text-3xl font-black">{data.list.name}</h1><p className="mt-1 opacity-70">A list by <b>{data.list.owner}</b> · {data.list.items.length} titles</p>
          {data.list.description && <p className="mt-2 max-w-2xl opacity-80">{data.list.description}</p>}
          <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">{data.list.items.map((i) => <PosterCard key={`${i.mediaType}-${i.tmdbId}`} item={toCard(i)} type={i.mediaType} className="w-full" />)}</div>
        </>)}
    </div>
  );
}
