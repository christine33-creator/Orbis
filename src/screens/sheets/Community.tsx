import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check, Flag, Gem as GemIcon, ImagePlus, MapPin, Mountain, Pencil, Plus, Send, Share2, Shield, ShieldOff, Trash2, UserMinus, UserPlus, Users, X,
} from "lucide-react";
import {
  useCommentMutations, useComments, useCommunities, useCommunity, useCreateCommunity, useCreatePost, useDeleteCommunity,
  useDeletePost, useDestination, useDestinations, useFollowing, useMe, useMemberAdmin, useMembers, useMemberships, useModerate,
  useMyRole, usePeople, usePost, usePostGem, usePosts, useToggleFollow, useToggleMembership, useUpdateCommunity, useUpdatePost,
} from "../../api/hooks";
import { useUi } from "../../store/ui";
import { useRequireAuth } from "../../components/auth";
import { Avatar, Button, Card, Chip, Field, Sheet, STYLE_META, Tag, inputCls } from "../../components/ui";
import {
  COMMUNITY_CATEGORY_META, CommunityCover, JoinButton, LikeButton, POST_KIND_META, PostCard, PostSaveButton,
} from "../../components/CommunityCards";
import { DestinationSelect } from "./Forms";
import { preparePhoto } from "../../lib/image";
import { needsReview } from "../../lib/rules";
import { APP_NAME, compact, cx, prettyCountry, relTime, shareText } from "../../lib/util";
import { errorText } from "../../i18n/errors";
import type { AuthorRef, Comment, Community, CommunityCategory, ContentStatus, NewCommunity, Post, PostKind, TravelStyle } from "../../types";

function Missing({ onClose, what }: { onClose: () => void; what: string }) {
  const { t } = useTranslation();
  return (
    <Sheet title={what} onClose={onClose}>
      <p className="py-6 text-center text-[14px] text-muted">{t("detail.unavailable", { what: what.toLowerCase() })}</p>
    </Sheet>
  );
}

function StatusBanner({ status, what }: { status: ContentStatus; what: "post" | "community" | "comment" }) {
  const { t } = useTranslation();
  if (status === "published") return null;
  return <p className="rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent">{t(`community.statusBanner.${status}`, { what: t(`community.what.${what}`) })}</p>;
}

/* ------------------------------------------------------------------ Community page */

export function CommunitySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: c, isLoading } = useCommunity(id);
  const { data: me } = useMe();
  const role = useMyRole(id);
  const dest = useDestination(c?.destinationId);
  const { data: members = [] } = useMembers(id);
  const [kind, setKind] = useState<PostKind | "all">("all");
  const { data: posts = [], isLoading: postsLoading } = usePosts({ communityId: id, limit: 100 });
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const del = useDeleteCommunity();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isLoading) return <Sheet full title={t("community.community")} onClose={onClose}><div className="h-60 animate-pulse rounded-3xl bg-card" /></Sheet>;
  if (!c) return <Missing onClose={onClose} what={t("community.community")} />;
  const isMod = role === "owner" || role === "moderator" || me?.role === "moderator" || me?.role === "admin";
  const shown = posts.filter((p) => kind === "all" || p.kind === kind);
  const CatIcon = COMMUNITY_CATEGORY_META[c.category].icon;

  const share = async () => {
    if (await shareText(c.name, t("community.shareText", { name: c.name, app: APP_NAME, slogan: t("brand.slogan") }))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <Sheet full title={c.name} onClose={onClose}>
      <div className="space-y-5">
        <div className="relative -mx-5 -mt-3 h-40 overflow-hidden"><CommunityCover c={c} /></div>
        <StatusBanner status={c.status} what="community" />
        <section>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag icon={CatIcon}>{t(`community.categories.${c.category}`)}</Tag>
            {c.official && <Tag tone="accent" icon={Mountain}>{t("community.official")}</Tag>}
            {role && role !== "member" && <Tag tone="dark">{t(`community.roles.${role}`)}</Tag>}
          </div>
          <h1 className="font-display mt-2 text-[28px] leading-tight font-semibold">{c.name}</h1>
          {(dest || c.country) && (
            <button onClick={() => dest && open({ type: "destination", id: dest.id })} className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-muted">
              <MapPin size={14} className="text-accent" /> {dest ? `${dest.name}, ${prettyCountry(dest.country)}` : prettyCountry(c.country)}
            </button>
          )}
          {c.description && <p className="mt-3 text-[14.5px] text-ink/80">{c.description}</p>}
          <button onClick={() => open({ type: "members", communityId: c.id })} className="mt-4 flex items-center gap-2" aria-label={t("community.seeMembers")}>
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((m) => <Avatar key={m.id} name={m.name || m.handle} hue={m.hue} src={m.avatarUrl} size={28} className="ring-2 ring-bg" />)}
            </div>
            <span className="text-[13px] font-bold">{t("community.members", { count: c.memberCount, n: compact(c.memberCount) })}</span>
            <span className="text-[13px] text-muted">· {t("community.postsN", { count: c.postCount })}</span>
          </button>
          <div className="mt-4 flex flex-wrap gap-2">
            <JoinButton c={c} />
            {role && c.status === "published" && (
              <Button icon={Plus} className="py-2" onClick={() => open({ type: "postForm", communityId: c.id })}>{t("community.newPost")}</Button>
            )}
            <button onClick={share} aria-label={t("community.share")} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card">
              {copied ? <Check size={16} className="text-green" /> : <Share2 size={16} />}
            </button>
            {(role === "owner" || role === "moderator") && (
              <button onClick={() => open({ type: "communityForm", id: c.id })} aria-label={t("community.edit")} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card">
                <Pencil size={16} />
              </button>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            <Chip active={kind === "all"} onClick={() => setKind("all")}>{t("community.allPosts")}</Chip>
            {(Object.keys(POST_KIND_META) as PostKind[]).map((k) => (
              <Chip key={k} icon={POST_KIND_META[k].icon} active={kind === k} onClick={() => setKind(k)}>{t(`community.kindsPlural.${k}`)}</Chip>
            ))}
          </div>
          {postsLoading && <div className="h-32 animate-pulse rounded-3xl bg-card" />}
          {shown.map((p) => <PostCard key={p.id} post={p} showCommunity={false} />)}
          {!postsLoading && shown.length === 0 && (
            <Card className="p-5 text-center">
              <p className="text-[14px] text-muted">{role ? t("community.beFirst") : t("community.joinToPost")}</p>
              {role && c.status === "published" && <Button className="mt-3" icon={Plus} onClick={() => open({ type: "postForm", communityId: c.id })}>{t("community.newPost")}</Button>}
            </Card>
          )}
        </section>

        <div className="flex flex-wrap justify-center gap-4 pt-2 text-[13px] font-bold text-muted">
          {role !== "owner" && (
            <button onClick={() => requireAuth(t("detail.signInToReport"), () => open({ type: "report", targetType: "community", targetId: c.id, label: c.name }))} className="flex items-center gap-1.5 hover:text-accent">
              <Flag size={14} /> {t("common.report")}
            </button>
          )}
          {(role === "owner" || (isMod && !role)) && (confirmDelete ? (
            <span className="flex items-center gap-2">
              {t("community.confirmDelete")}
              <button className="text-accent" onClick={() => del.mutate(c.id, { onSuccess: onClose })}>{t("common.delete")}</button>
              <button onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 hover:text-accent"><Trash2 size={14} /> {t("community.delete")}</button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Members */

export function MembersSheet({ communityId, onClose }: { communityId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: members = [], isLoading } = useMembers(communityId);
  const { data: me } = useMe();
  const role = useMyRole(communityId);
  const admin = useMemberAdmin(communityId);
  const open = useUi((s) => s.open);
  const siteMod = me?.role === "moderator" || me?.role === "admin";
  return (
    <Sheet title={t("community.membersTitle")} onClose={onClose}>
      <div className="space-y-2">
        {isLoading && <div className="h-24 animate-pulse rounded-3xl bg-card" />}
        {members.map((m) => {
          const canPromote = (role === "owner" || siteMod) && m.role !== "owner" && m.id !== me?.id;
          const canRemove = m.id !== me?.id && m.role !== "owner" && (siteMod || (m.role === "member" && (role === "owner" || role === "moderator")) || (m.role === "moderator" && role === "owner"));
          return (
            <Card key={m.id} className="flex items-center gap-3 p-2.5">
              <button onClick={() => open({ type: "profile", id: m.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar name={m.name || m.handle} hue={m.hue} src={m.avatarUrl} size={40} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold">{m.name || `@${m.handle}`}</div>
                  <div className="truncate text-[12px] text-muted">@{m.handle}</div>
                </div>
              </button>
              {m.role !== "member" && <Tag tone={m.role === "owner" ? "dark" : "accent"}>{t(`community.roles.${m.role}`)}</Tag>}
              {canPromote && (
                <button aria-label={m.role === "moderator" ? t("community.demote", { handle: m.handle }) : t("community.promote", { handle: m.handle })}
                  onClick={() => admin.setRole.mutate({ userId: m.id, role: m.role === "moderator" ? "member" : "moderator" })}
                  className="grid h-9 w-9 place-items-center rounded-full bg-chip">
                  {m.role === "moderator" ? <ShieldOff size={15} /> : <Shield size={15} />}
                </button>
              )}
              {canRemove && (
                <button aria-label={t("community.remove", { handle: m.handle })} onClick={() => admin.remove.mutate(m.id)} className="grid h-9 w-9 place-items-center rounded-full bg-chip">
                  <UserMinus size={15} />
                </button>
              )}
            </Card>
          );
        })}
        <p className="pt-2 text-center text-[12px] text-faint">{t("community.privateMembersNote")}</p>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Post page */

export function PostSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: post, isLoading } = usePost(id);
  const { data: me } = useMe();
  const user = useUi((s) => s.user);
  const role = useMyRole(post?.communityId ?? "");
  const dest = useDestination(post?.destinationId);
  const { data: gem } = usePostGem(id);
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const del = useDeletePost();
  const moderate = useModerate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) return <Sheet full title={t("community.post")} onClose={onClose}><div className="h-60 animate-pulse rounded-3xl bg-card" /></Sheet>;
  if (!post) return <Missing onClose={onClose} what={t("community.post")} />;
  const mine = user?.id === post.authorId;
  const isMod = role === "owner" || role === "moderator" || me?.role === "moderator" || me?.role === "admin";
  const KindIcon = POST_KIND_META[post.kind].icon;
  const a = post.author;

  return (
    <Sheet full title={post.community?.name ?? t("community.post")} onClose={onClose}>
      <div className="space-y-4">
        <StatusBanner status={post.status} what="post" />
        <div className="flex items-center gap-3">
          <button disabled={!a} onClick={() => a && open({ type: "profile", id: a.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Avatar name={a ? a.name || a.handle : "?"} hue={a?.hue ?? 200} src={a?.avatarUrl} size={42} />
            <div className="min-w-0">
              <div className="truncate text-[14.5px] font-bold">{a ? a.name || `@${a.handle}` : t("common.anExplorer")}</div>
              <div className="truncate text-[12px] text-muted">
                {a ? `@${a.handle} · ` : ""}{relTime(post.createdAt)}{post.editedAt ? ` · ${t("community.edited")}` : ""}
              </div>
            </div>
          </button>
          {post.community && (
            <button onClick={() => open({ type: "community", id: post.communityId })} className="max-w-[40%] truncate rounded-full bg-chip px-3 py-1.5 text-[12px] font-bold">
              {post.community.name}
            </button>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold tracking-wide text-accent uppercase"><KindIcon size={14} /> {t(`community.kinds.${post.kind}`)}</div>
          <h1 className="font-display mt-1 text-[26px] leading-tight font-semibold">{post.title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-ink/85">{post.body}</p>
        </div>
        {post.photos.length > 0 && (
          <div className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5">
            {post.photos.map((src, i) => (
              <img key={src} src={src} alt={t("detail.photo", { n: i + 1 })} className="h-56 w-[85%] shrink-0 snap-center rounded-3xl object-cover" />
            ))}
          </div>
        )}
        {(dest || post.place) && (
          <button onClick={() => dest && open({ type: "destination", id: dest.id })} disabled={!dest}
            className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent"><MapPin size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold">{post.place || dest?.name}</span>
              {dest && <span className="block truncate text-[12px] text-muted">{t("community.openInExplore", { place: `${dest.name}, ${prettyCountry(dest.country)}` })}</span>}
            </span>
          </button>
        )}

        {post.kind === "recommendation" && (gem ? (
          <button onClick={() => open({ type: "gem", id: gem.id })} className="flex w-full items-center gap-3 rounded-2xl bg-mint p-3 text-left">
            <GemIcon size={18} className="text-green" />
            <span className="flex-1 text-[13.5px] font-bold text-green">{gem.status === "published" ? t("community.inExplore") : t("community.gemInReview")}</span>
          </button>
        ) : mine && post.status === "published" ? (
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[14px] font-bold"><GemIcon size={17} className="text-accent" /> {t("community.suggestTitle")}</div>
            <p className="mt-1 text-[13px] text-muted">{t("community.suggestBody")}</p>
            <Button variant="soft" className="mt-3 w-full" icon={GemIcon}
              onClick={() => open({ type: "shareGem", destinationId: post.destinationId ?? undefined, fromPost: { id: post.id, name: post.place || post.title, description: post.body } })}>
              {t("community.suggestCta")}
            </Button>
          </Card>
        ) : null)}

        <div className="-mx-1.5 flex items-center gap-1 border-y border-line py-1">
          <LikeButton post={post} />
          <span className="px-2.5 text-[13px] font-bold text-ink/75">{t("community.commentsN", { count: post.comments })}</span>
          <span className="flex-1" />
          <PostSaveButton post={post} />
        </div>

        <Comments post={post} canComment={!!role && post.status === "published"} isMod={isMod} />

        <div className="flex flex-wrap justify-center gap-4 pt-2 text-[13px] font-bold text-muted">
          {mine && <button onClick={() => open({ type: "postForm", postId: post.id })} className="flex items-center gap-1.5 hover:text-accent"><Pencil size={14} /> {t("community.editPost")}</button>}
          {!mine && (
            <button onClick={() => requireAuth(t("detail.signInToReport"), () => open({ type: "report", targetType: "post", targetId: post.id, label: post.title, authorId: post.authorId }))} className="flex items-center gap-1.5 hover:text-accent">
              <Flag size={14} /> {t("common.report")}
            </button>
          )}
          {isMod && !mine && (
            <button onClick={() => moderate.mutate({ type: "post", id: post.id, status: post.status === "published" ? "hidden" : "published", note: "" })} className="flex items-center gap-1.5 hover:text-accent">
              {post.status === "published" ? <ShieldOff size={14} /> : <Shield size={14} />} {post.status === "published" ? t("community.hide") : t("community.restore")}
            </button>
          )}
          {(mine || isMod) && (confirmDelete ? (
            <span className="flex items-center gap-2">
              {t("community.confirmDeletePost")}
              <button className="text-accent" onClick={() => del.mutate(post.id, { onSuccess: onClose })}>{t("common.delete")}</button>
              <button onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 hover:text-accent"><Trash2 size={14} /> {t("common.delete")}</button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function Comments({ post, canComment, isMod }: { post: Post; canComment: boolean; isMod: boolean }) {
  const { t } = useTranslation();
  const { data: comments = [], isLoading } = useComments(post.id);
  const { add } = useCommentMutations(post.id);
  const [body, setBody] = useState("");
  const toast = useUi((s) => s.toast);
  const requireAuth = useRequireAuth();
  const join = useToggleMembership();
  const { data: memberships = [] } = useMemberships();
  const joined = memberships.some((m) => m.communityId === post.communityId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    add.mutate(body, {
      onSuccess: (c) => {
        setBody("");
        if (c.status === "pending") toast({ text: t("forms.sentForReview"), sub: t("community.commentReview"), tone: "info" });
      },
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-bold">{t("community.comments")}</h2>
      {isLoading && <div className="h-16 animate-pulse rounded-2xl bg-card" />}
      {comments.map((c) => <CommentRow key={c.id} c={c} postId={post.id} isMod={isMod} />)}
      {!isLoading && comments.length === 0 && <p className="text-[13.5px] text-muted">{t("community.noComments")}</p>}
      {canComment ? (
        <form onSubmit={submit} className="flex items-end gap-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={1} placeholder={t("community.commentPh")} aria-label={t("community.commentPh")}
            className={cx(inputCls, "min-h-[48px] flex-1 resize-none py-3")} />
          <button type="submit" disabled={!body.trim() || add.isPending} aria-label={t("community.sendComment")} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40">
            <Send size={18} />
          </button>
        </form>
      ) : post.status === "published" && !joined ? (
        <Button variant="soft" className="w-full" icon={UserPlus} disabled={join.isPending}
          onClick={() => requireAuth(t("community.signInToJoin"), () => join.mutate({ id: post.communityId, on: true }))}>
          {t("community.joinToComment")}
        </Button>
      ) : null}
    </section>
  );
}

function CommentRow({ c, postId, isMod }: { c: Comment; postId: string; isMod: boolean }) {
  const { t } = useTranslation();
  const user = useUi((s) => s.user);
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const { update, remove } = useCommentMutations(postId);
  const moderate = useModerate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const mine = user?.id === c.authorId;
  const a = c.author;
  return (
    <div className="flex gap-2.5">
      <button disabled={!a} onClick={() => a && open({ type: "profile", id: a.id })} aria-label={a ? `@${a.handle}` : t("common.anExplorer")}>
        <Avatar name={a ? a.name || a.handle : "?"} hue={a?.hue ?? 200} src={a?.avatarUrl} size={32} />
      </button>
      <div className="min-w-0 flex-1 rounded-2xl bg-card px-3.5 py-2.5 shadow-sm">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-bold">{a ? a.name || `@${a.handle}` : t("common.anExplorer")}</span>
          <span className="shrink-0 text-[11px] text-faint">{relTime(c.createdAt)}{c.editedAt ? ` · ${t("community.edited")}` : ""}</span>
        </div>
        {c.status !== "published" && <div className="mt-1"><Tag tone="accent">{t(`community.status.${c.status}`)}</Tag></div>}
        {editing ? (
          <div className="mt-1.5 space-y-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} className={cx(inputCls, "min-h-[70px] resize-none")} aria-label={t("community.editComment")} />
            <div className="flex justify-end gap-2">
              <Button variant="soft" className="px-3 py-1.5" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
              <Button className="px-3 py-1.5" disabled={!draft.trim()} onClick={() => update.mutate({ id: c.id, body: draft }, { onSuccess: () => setEditing(false) })}>{t("common.save")}</Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-[14px] whitespace-pre-line text-ink/85">{c.body}</p>
        )}
        {!editing && (
          <div className="mt-1.5 flex gap-3 text-[11.5px] font-bold text-muted">
            {mine && <button onClick={() => setEditing(true)} className="hover:text-accent">{t("community.edit")}</button>}
            {(mine || isMod) && <button onClick={() => remove.mutate(c.id)} className="hover:text-accent">{t("common.delete")}</button>}
            {!mine && (
              <button onClick={() => requireAuth(t("detail.signInToReport"), () => open({ type: "report", targetType: "comment", targetId: c.id, label: t("community.thisComment"), authorId: c.authorId }))} className="hover:text-accent">
                {t("common.report")}
              </button>
            )}
            {isMod && !mine && (
              <button onClick={() => moderate.mutate({ type: "comment", id: c.id, status: c.status === "published" ? "hidden" : "published", note: "" })} className="hover:text-accent">
                {c.status === "published" ? t("community.hide") : t("community.restore")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ New / edit post */

export function PostFormSheet({ communityId, postId, onClose }: { communityId?: string; postId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: existing } = usePost(postId ?? "");
  const { data: communities = [] } = useCommunities();
  const { data: memberships = [] } = useMemberships();
  const create = useCreatePost();
  const update = useUpdatePost();
  const open = useUi((s) => s.open);
  const toast = useUi((s) => s.toast);
  const editing = !!postId;
  const [target, setTarget] = useState(communityId ?? "");
  const [kind, setKind] = useState<PostKind>("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [place, setPlace] = useState("");
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    if (!existing || loaded) return;
    setTarget(existing.communityId);
    setKind(existing.kind);
    setTitle(existing.title);
    setBody(existing.body);
    setDestinationId(existing.destinationId ?? "");
    setPlace(existing.place);
    setLoaded(true);
  }, [existing, loaded]);
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const myGroups = memberships.map((m) => communities.find((c) => c.id === m.communityId)).filter((c): c is Community => !!c && c.status === "published");
  const valid = !!target && title.trim().length >= 3 && body.trim().length >= 1;
  const flagged = needsReview(`${title} ${body} ${place}`);
  const busy = create.isPending || update.isPending;

  const addPhotos = async (files: FileList | null) => {
    setPhotoError("");
    if (!files) return;
    for (const f of Array.from(files).slice(0, 6 - photos.length)) {
      try {
        const blob = await preparePhoto(f);
        setPhotos((p) => [...p, { blob, url: URL.createObjectURL(blob) }]);
      } catch (e) {
        setPhotoError(errorText(t, e));
      }
    }
  };

  const submit = () => {
    const fields = { kind, title, body, destinationId: destinationId || null, place };
    if (editing) {
      update.mutate({ id: postId!, patch: fields }, { onSuccess: onClose });
      return;
    }
    create.mutate({ post: { communityId: target, ...fields }, photos: photos.map((p) => p.blob) }, {
      onSuccess: (post) => {
        onClose();
        if (post.status === "pending") toast({ text: t("forms.sentForReview"), sub: t("forms.sentForReviewSub"), tone: "info" });
        open({ type: "post", id: post.id });
      },
    });
  };

  return (
    <Sheet full title={editing ? t("community.editPost") : t("community.newPost")} onClose={onClose}
      footer={<Button className="w-full" icon={editing ? Check : Send} disabled={!valid || busy || !loaded} onClick={submit}>
        {busy ? t("common.pleaseWait") : editing ? t("forms.saveChanges") : t("community.publish")}
      </Button>}>
      <div className="space-y-5">
        {!editing && !communityId && (
          <Field label={t("community.postIn")}>
            <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{t("community.chooseGroup")}</option>
              {myGroups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {!editing && !communityId && myGroups.length === 0 && <p className="text-[13px] text-muted">{t("community.joinFirstHint")}</p>}
        <Field group label={t("community.postType")}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(POST_KIND_META) as PostKind[]).map((k) => (
              <Chip key={k} icon={POST_KIND_META[k].icon} active={kind === k} onClick={() => setKind(k)}>{t(`community.kinds.${k}`)}</Chip>
            ))}
          </div>
        </Field>
        <Field label={t("community.postTitle")}>
          <input className={inputCls} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t(`community.titlePh.${kind}`)} />
        </Field>
        <Field label={t("community.postBody")} hint={t("community.bodyHint", { count: body.trim().length })}>
          <textarea className={cx(inputCls, "min-h-[140px] resize-none")} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} placeholder={t("community.bodyPh")} />
        </Field>
        <Field label={t("community.place")} hint={t("community.placeHint")}>
          <input className={inputCls} value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} placeholder={t("community.placePh")} />
        </Field>
        <Field label={t("forms.destination")}>
          <DestinationSelect value={destinationId} onChange={setDestinationId} />
        </Field>
        {!editing && (
          <Field group label={t("forms.photos", { count: photos.length })} hint={photoError || t("forms.photosHint")}>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-xl">
                  <img src={p.url} alt={t("detail.photo", { n: i + 1 })} className="h-full w-full object-cover" />
                  <button aria-label={t("forms.removePhoto", { n: i + 1 })} onClick={() => setPhotos((x) => x.filter((_, k) => k !== i))} className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-navy/70 text-white"><X size={13} /></button>
                </div>
              ))}
              {photos.length < 6 && (
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line bg-card text-muted">
                  <ImagePlus size={22} />
                  <span className="sr-only">{t("community.addPhotos")}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </Field>
        )}
        {flagged && <p className="rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent">{t("community.reviewWarning")}</p>}
        <p className="text-[12px] text-faint">{t("community.postGuidelines")} <button type="button" onClick={() => open({ type: "guidelines" })} className="font-bold text-accent underline">{t("forms.guidelines")}</button>.</p>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ New / edit community */

const HUES = [345, 15, 50, 130, 160, 200, 230, 280];

export function CommunityFormSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: existing } = useCommunity(id ?? "");
  const { data: destinations = [] } = useDestinations();
  const create = useCreateCommunity();
  const update = useUpdateCommunity();
  const open = useUi((s) => s.open);
  const toast = useUi((s) => s.toast);
  const [draft, setDraft] = useState<NewCommunity>({ name: "", description: "", category: "interest", destinationId: null, country: "", styles: [], hue: 15 });
  const [loaded, setLoaded] = useState(!id);
  useEffect(() => {
    if (!existing || loaded) return;
    setDraft({ name: existing.name, description: existing.description, category: existing.category, destinationId: existing.destinationId, country: existing.country, styles: existing.styles, hue: existing.hue });
    setLoaded(true);
  }, [existing, loaded]);
  const set = (p: Partial<NewCommunity>) => setDraft((d) => ({ ...d, ...p }));
  const valid = draft.name.trim().length >= 3;
  const busy = create.isPending || update.isPending;
  const preview: Community = { ...draft, id: "preview", slug: "", official: false, createdBy: null, status: "published", memberCount: 1, postCount: 0, createdAt: "" };
  const flagged = needsReview(`${draft.name} ${draft.description}`);

  const submit = () => {
    const dest = destinations.find((d) => d.id === draft.destinationId);
    const payload = { ...draft, country: dest?.country ?? draft.country };
    if (id) {
      update.mutate({ id, patch: payload }, { onSuccess: onClose });
      return;
    }
    create.mutate(payload, {
      onSuccess: (c) => {
        onClose();
        if (c.status === "pending") toast({ text: t("forms.sentForReview"), sub: t("forms.sentForReviewSub"), tone: "info" });
        open({ type: "community", id: c.id });
      },
    });
  };

  return (
    <Sheet full title={id ? t("community.edit") : t("community.create")} onClose={onClose}
      footer={<Button className="w-full" icon={id ? Check : Users} disabled={!valid || busy || !loaded} onClick={submit}>
        {busy ? t("common.pleaseWait") : id ? t("forms.saveChanges") : t("community.createCta")}
      </Button>}>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-3xl"><div className="h-28"><CommunityCover c={preview} /></div></div>
        <Field label={t("community.name")}>
          <input className={inputCls} value={draft.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder={t("community.namePh")} />
        </Field>
        <Field label={t("community.description")} hint={`${draft.description.length}/500`}>
          <textarea className={cx(inputCls, "min-h-[96px] resize-none")} value={draft.description} maxLength={500} onChange={(e) => set({ description: e.target.value })} placeholder={t("community.descriptionPh")} />
        </Field>
        <Field group label={t("community.categoryLabel")}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(COMMUNITY_CATEGORY_META) as CommunityCategory[]).map((k) => (
              <Chip key={k} icon={COMMUNITY_CATEGORY_META[k].icon} active={draft.category === k} onClick={() => set({ category: k })}>{t(`community.categories.${k}`)}</Chip>
            ))}
          </div>
        </Field>
        <Field label={t("community.aboutPlace")}>
          <DestinationSelect value={draft.destinationId ?? ""} onChange={(v) => set({ destinationId: v || null })} />
        </Field>
        <Field group label={t("forms.goodFor")}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STYLE_META) as TravelStyle[]).map((st) => (
              <Chip key={st} active={draft.styles.includes(st)}
                onClick={() => set({ styles: draft.styles.includes(st) ? draft.styles.filter((x) => x !== st) : draft.styles.length < 6 ? [...draft.styles, st] : draft.styles })}>
                {t(`styles.${st}`)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field group label={t("onboarding.colour")}>
          <div className="flex flex-wrap gap-2">
            {HUES.map((h) => (
              <button key={h} type="button" aria-label={t("community.colourN", { n: h })} aria-pressed={draft.hue === h} onClick={() => set({ hue: h })}
                className={cx("h-8 w-8 rounded-full", draft.hue === h && "ring-2 ring-ink ring-offset-2")} style={{ background: `hsl(${h} 55% 52%)` }} />
            ))}
          </div>
        </Field>
        {flagged && <p className="rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent">{t("community.reviewWarning")}</p>}
        <p className="text-[12px] text-faint">{t("community.publicNote")}</p>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Followers / following */

export function PeopleSheet({ userId, which, onClose }: { userId: string; which: "followers" | "following"; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: people = [], isLoading } = usePeople(userId, which);
  return (
    <Sheet title={which === "followers" ? t("common.followers") : t("common.following")} onClose={onClose}>
      <div className="space-y-2">
        {isLoading && <div className="h-24 animate-pulse rounded-3xl bg-card" />}
        {people.map((p) => <PersonRow key={p.id} p={p} />)}
        {!isLoading && people.length === 0 && <p className="py-6 text-center text-[14px] text-muted">{t(which === "followers" ? "community.noFollowers" : "community.noFollowing")}</p>}
      </div>
    </Sheet>
  );
}

function PersonRow({ p }: { p: AuthorRef }) {
  const { t } = useTranslation();
  const open = useUi((s) => s.open);
  const user = useUi((s) => s.user);
  const { data: following = [] } = useFollowing();
  const follow = useToggleFollow();
  const requireAuth = useRequireAuth();
  const on = following.includes(p.id);
  return (
    <Card className="flex items-center gap-3 p-2.5">
      <button onClick={() => open({ type: "profile", id: p.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar name={p.name || p.handle} hue={p.hue} src={p.avatarUrl} size={40} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold">{p.name || `@${p.handle}`}</div>
          <div className="truncate text-[12px] text-muted">@{p.handle}</div>
        </div>
      </button>
      {user?.id !== p.id && (
        <Button variant={on ? "soft" : "primary"} className="px-3.5 py-2 text-[12.5px]"
          onClick={() => requireAuth(t("detail.signInToFollow"), () => follow.mutate({ id: p.id, on: !on }))}>
          {on ? t("common.following") : t("common.follow")}
        </Button>
      )}
    </Card>
  );
}

/** "Communities about this place" on destination pages: where Explore meets Community. */
export function PlaceCommunity({ destinationId, country }: { destinationId: string; country: string }) {
  const { t } = useTranslation();
  const open = useUi((s) => s.open);
  const { data: communities = [] } = useCommunities();
  const { data: posts = [] } = usePosts({ destinationId, limit: 3 });
  const related = communities.filter((c) => c.status === "published" && (c.destinationId === destinationId || (!!country && c.country === country))).slice(0, 3);
  const live = posts.filter((p) => p.status === "published");
  if (!related.length && !live.length) return null;
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-1.5 text-[17px] font-bold"><Users size={17} className="text-accent" /> {t("community.travelersTalking")}</h3>
      {related.map((c) => (
        <button key={c.id} onClick={() => open({ type: "community", id: c.id })} className="flex w-full items-center gap-3 rounded-2xl bg-card p-2.5 text-left shadow-sm">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl"><CommunityCover c={c} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold">{c.name}</div>
            <div className="text-[12px] text-muted">{t("community.members", { count: c.memberCount, n: compact(c.memberCount) })}</div>
          </div>
        </button>
      ))}
      {live.map((p) => (
        <button key={p.id} onClick={() => open({ type: "post", id: p.id })} className="block w-full rounded-2xl bg-card p-3 text-left shadow-sm">
          <div className="text-[11px] font-bold tracking-wide text-accent uppercase">{t(`community.kinds.${p.kind}`)} · {p.community?.name}</div>
          <div className="mt-0.5 line-clamp-2 text-[14px] font-bold">{p.title}</div>
        </button>
      ))}
    </section>
  );
}
