import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Eye, ListVideo, Search, Star, UserCheck, UserPlus, Users } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { useDebounced, useFetch } from "../lib/hooks";
import { useToast } from "../context/ToastContext";
import { Button, Card, Empty, ErrorBox, Input, PageHeader, Pagination, Spinner, Tabs } from "../components/ui";
import { timeAgo } from "../lib/utils";

const Person = ({ u, right }) => (
  <Card className="flex items-center justify-between gap-3 !p-3.5"><Link to={`/u/${u.username}`} className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 font-bold text-white">{u.username[0].toUpperCase()}</div><span className="truncate font-semibold">{u.username}</span></Link>{right}</Card>
);

function Feed() {
  const [page, setPage] = useState(1); const { data, loading } = useFetch(() => api.get("/social/feed", { params: { page, limit: 15 } }), [page]);
  if (loading) return <Spinner />;
  if (!data.items.length) return <Card><Empty icon={Users} title="Nothing from your friends yet" text="Follow people who share their activity. Switch yours on in Settings." /></Card>;
  const line = (a) => {
    const p = a.payload || {}, t = p.tmdbId ? <Link className="font-semibold text-fuchsia-500" to={`/title/${p.mediaType}/${p.tmdbId}`}>{p.title || "a title"}</Link> : null;
    if (a.type === "rated") return <>rated {t} <span className="inline-flex items-center gap-0.5 font-bold text-amber-500"><Star size={13} className="fill-amber-400" />{p.stars}/5</span></>;
    if (a.type === "watched") return <>finished watching {t}</>;
    if (a.type === "reviewed") return <>reviewed {t || "a title"}</>;
    return <>shared a public list{p.shareId ? <> <Link className="font-semibold text-fuchsia-500" to={`/lists/shared/${p.shareId}`}>{p.name}</Link></> : ""}</>;
  };
  return (<><div className="space-y-2.5">{data.items.map((a, i) => <Card key={i} className="flex items-center gap-3 !p-3.5"><Link to={`/u/${a.user}`} className="font-bold">{a.user}</Link><span className="min-w-0 flex-1 text-sm">{line(a)}</span><span className="shrink-0 text-xs opacity-60">{timeAgo(a.at)}</span></Card>)}</div><Pagination pagination={data.pagination} onPage={setPage} /></>);
}

function People({ kind }) {
  const toast = useToast(); const { data, loading, reload } = useFetch(() => api.get(`/social/${kind}`), [kind]);
  const unfollow = async (n) => { try { await api.delete(`/social/follow/${n}`); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  const follow = async (n) => { try { await api.post(`/social/follow/${n}`); toast(`Following ${n}`); } catch (e) { toast(errMsg(e), "error"); } };
  if (loading) return <Spinner />;
  if (!data.users.length) return <Card><Empty icon={Users} title={kind === "following" ? "You are not following anyone" : "No followers yet"} /></Card>;
  return <div className="grid gap-2.5 sm:grid-cols-2">{data.users.map((u) => <Person key={u.username} u={u} right={kind === "following" ? <Button size="sm" variant="ghost" onClick={() => unfollow(u.username)}>Unfollow</Button> : <Button size="sm" variant="soft" onClick={() => follow(u.username)}><UserPlus size={14} /> Follow back</Button>} />)}</div>;
}

function Find() {
  const toast = useToast(); const [q, setQ] = useState(""); const dq = useDebounced(q, 350);
  const { data, loading } = useFetch(() => (dq.trim().length >= 2 ? api.get("/social/search", { params: { q: dq.trim() } }) : Promise.resolve({ data: { users: [] } })), [dq]);
  const follow = async (n) => { try { await api.post(`/social/follow/${n}`); toast(`Following ${n}`); } catch (e) { toast(errMsg(e), "error"); } };
  return (<div className="space-y-4"><div className="relative max-w-md"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" /><Input className="pl-10" placeholder="Find people by username" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {loading ? <Spinner className="!py-6" /> : <div className="grid gap-2.5 sm:grid-cols-2">{data.users.map((u) => <Person key={u.username} u={u} right={<Button size="sm" variant="soft" onClick={() => follow(u.username)}><UserPlus size={14} /> Follow</Button>} />)}</div>}</div>);
}

export default function Friends() {
  const [tab, setTab] = useState("feed");
  return (
    <>
      <PageHeader title="Friends" subtitle="See what people you follow are watching. You only appear to others if you turn on “share my activity” in Settings." />
      <div className="mb-5"><Tabs value={tab} onChange={setTab} tabs={[{ value: "feed", label: "Activity" }, { value: "following", label: "Following" }, { value: "followers", label: "Followers" }, { value: "find", label: "Find people" }]} /></div>
      {tab === "feed" ? <Feed /> : tab === "find" ? <Find /> : <People kind={tab} />}
    </>
  );
}

export function UserPage() {
  const { username } = useParams(); const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get(`/social/users/${username}`), [username]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  const u = data.user;
  const toggle = async () => { try { u.isFollowing ? await api.delete(`/social/follow/${u.username}`) : await api.post(`/social/follow/${u.username}`); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <>
      <Card className="mb-6 flex flex-wrap items-center gap-5">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 text-3xl font-black text-white">{u.username[0].toUpperCase()}</div>
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-black">{u.username}</h1><p className="text-sm opacity-70">{u.followers} followers · {u.following} following · {u.sharesActivity ? <span className="inline-flex items-center gap-1"><Eye size={13} /> shares activity</span> : "activity is private"}</p></div>
        <Button variant={u.isFollowing ? "ghost" : "primary"} onClick={toggle}>{u.isFollowing ? <><UserCheck size={16} /> Following</> : <><UserPlus size={16} /> Follow</>}</Button>
      </Card>
      <h2 className="mb-3 text-lg font-extrabold">Public lists</h2>
      {!u.publicLists.length ? <Card><Empty icon={ListVideo} title="No public lists" /></Card> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{u.publicLists.map((l) => <Link key={l.shareId} to={`/lists/shared/${l.shareId}`}><Card className="!p-4 transition hover:-translate-y-1"><p className="font-bold">{l.name}</p><p className="text-xs opacity-60">{l.itemCount} titles</p></Card></Link>)}</div>}
    </>
  );
}
