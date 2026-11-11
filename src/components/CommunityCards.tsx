import { Bookmark, BookmarkCheck, Check, CircleHelp, Heart, Lightbulb, MapPin, MessageCircle, MessagesSquare, Mountain, Plane, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Community, CommunityCategory, Post, PostKind, Scene as SceneT, SceneKind } from "../types";
import {
  useDestination, useLikes, useMemberships, useSavedPosts, useToggleLike, useTogglePostSave, useToggleMembership,
} from "../api/hooks";
import { useUi } from "../store/ui";
import { useRequireAuth } from "./auth";
import { Scene } from "./Scene";
import { Avatar, Card, Tag } from "./ui";
import { compact, cx, relTime } from "../lib/util";

export const POST_KIND_META: Record<PostKind, { icon: LucideIcon }> = {
  discussion: { icon: MessagesSquare },
  question: { icon: CircleHelp },
  recommendation: { icon: Lightbulb },
  experience: { icon: Plane },
};

export const COMMUNITY_CATEGORY_META: Record<CommunityCategory, { icon: LucideIcon; scene: SceneKind }> = {
  place: { icon: MapPin, scene: "city" },
  interest: { icon: Sparkles, scene: "mountain" },
  people: { icon: Users, scene: "coast" },
};

/** Cover art: the destination's illustrated scene, or one tinted with the community's colour. */
export function communityScene(c: Pick<Community, "category" | "hue">, destScene?: SceneT): SceneT {
  if (destScene) return destScene;
  const h = c.hue;
  return {
    kind: COMMUNITY_CATEGORY_META[c.category].scene,
    palette: [`hsl(${h} 70% 82%)`, `hsl(${(h + 30) % 360} 75% 92%)`, `hsl(${h} 35% 52%)`, `hsl(${h} 40% 28%)`],
  };
}

export function CommunityCover({ c, className, seed = 0 }: { c: Community; className?: string; seed?: number }) {
  const dest = useDestination(c.destinationId);
  return <Scene scene={communityScene(c, dest?.scene)} seed={seed} className={className} />;
}

export function JoinButton({ c, size = "md" }: { c: Community; size?: "sm" | "md" }) {
  const { t } = useTranslation();
  const { data: memberships = [] } = useMemberships();
  const toggle = useToggleMembership();
  const requireAuth = useRequireAuth();
  const role = memberships.find((m) => m.communityId === c.id)?.role;
  const joined = !!role;
  if (role === "owner") return <Tag tone="dark">{t("community.roles.owner")}</Tag>;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        requireAuth(t("community.signInToJoin"), () => toggle.mutate({ id: c.id, on: !joined }));
      }}
      disabled={toggle.isPending || c.status !== "published"}
      aria-label={joined ? t("community.leaveName", { name: c.name }) : t("community.joinName", { name: c.name })}
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-bold transition disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]",
        joined ? "bg-chip text-ink" : "bg-accent text-white hover:bg-accent-dark",
      )}
    >
      {joined && <Check size={13} strokeWidth={3} />}
      {joined ? t("community.joined") : t("community.join")}
    </button>
  );
}

/** List row for a community (search, discover, my groups). */
export function CommunityRow({ c, seed = 0, note }: { c: Community; seed?: number; note?: string }) {
  const { t } = useTranslation();
  const open = useUi((s) => s.open);
  const CatIcon = COMMUNITY_CATEGORY_META[c.category].icon;
  return (
    <Card className="flex items-center gap-3 p-3">
      <button onClick={() => open({ type: "community", id: c.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl"><CommunityCover c={c} seed={seed} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-bold">{c.name}</span>
          {c.official && <span title={t("community.official")}><Mountain size={13} className="shrink-0 text-accent" aria-label={t("community.official")} /></span>}
        </div>
        <div className="line-clamp-1 text-[12.5px] text-muted">{note || c.description}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-faint">
          <CatIcon size={12} /> {t(`community.categories.${c.category}`)} · {t("community.members", { count: c.memberCount, n: compact(c.memberCount) })}
        </div>
      </div>
      </button>
      <JoinButton c={c} size="sm" />
    </Card>
  );
}

/** Larger card used in horizontal "recommended" rails. */
export function CommunityTile({ c, seed = 0, reason }: { c: Community; seed?: number; reason?: string }) {
  const { t } = useTranslation();
  const open = useUi((s) => s.open);
  return (
    <Card className="w-[230px] shrink-0 overflow-hidden">
      <button onClick={() => open({ type: "community", id: c.id })} className="block w-full text-left">
        <div className="relative h-24"><CommunityCover c={c} seed={seed} /></div>
        <div className="px-3 pt-3">
          <div className="truncate text-[15px] font-bold">{c.name}</div>
          <div className="truncate text-[12px] text-muted">{reason || t("community.members", { count: c.memberCount, n: compact(c.memberCount) })}</div>
        </div>
      </button>
      <div className="px-3 pb-3">
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[11.5px] font-semibold text-faint">{t("community.postsN", { count: c.postCount })}</span>
          <JoinButton c={c} size="sm" />
        </div>
      </div>
    </Card>
  );
}

export function LikeButton({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { data: likes = [] } = useLikes();
  const toggle = useToggleLike();
  const requireAuth = useRequireAuth();
  const user = useUi((s) => s.user);
  const liked = likes.includes(post.id);
  const mine = user?.id === post.authorId;
  const count = post.likes + (liked && !post.likes ? 1 : 0);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        requireAuth(t("community.signInToLike"), () => toggle.mutate({ id: post.id, on: !liked }));
      }}
      disabled={mine || post.status !== "published"}
      aria-pressed={liked}
      aria-label={liked ? t("community.unlike") : t("community.like")}
      className={cx("flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-bold transition disabled:opacity-60", liked ? "text-accent" : "text-ink/75 hover:bg-chip")}
    >
      <Heart size={17} fill={liked ? "currentColor" : "none"} /> {compact(count)}
    </button>
  );
}

export function PostSaveButton({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { data: saved = [] } = useSavedPosts();
  const toggle = useTogglePostSave();
  const requireAuth = useRequireAuth();
  const on = saved.includes(post.id);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        requireAuth(t("community.signInToSave"), () => toggle.mutate({ id: post.id, on: !on }));
      }}
      aria-pressed={on}
      aria-label={on ? t("community.unsavePost") : t("community.savePost")}
      className={cx("grid h-9 w-9 place-items-center rounded-full transition", on ? "text-accent" : "text-ink/75 hover:bg-chip")}
    >
      {on ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
    </button>
  );
}

export function StatusNote({ status }: { status: Post["status"] }) {
  const { t } = useTranslation();
  if (status === "published") return null;
  return <Tag tone="accent">{t(`community.status.${status}`)}</Tag>;
}

/** Post preview in feeds. */
export function PostCard({ post, showCommunity = true }: { post: Post; showCommunity?: boolean }) {
  const { t } = useTranslation();
  const open = useUi((s) => s.open);
  const dest = useDestination(post.destinationId);
  const KindIcon = POST_KIND_META[post.kind].icon;
  const author = post.author;
  const go = () => open({ type: "post", id: post.id });
  // The whole card opens the post for pointer users; the title is the keyboard/screen-reader target,
  // so the like and save buttons are never nested inside another button.
  return (
    <article onClick={go} className="cursor-pointer rounded-3xl bg-card p-4 shadow-[0_1px_2px_rgba(20,20,30,0.04),0_4px_16px_rgba(20,20,30,0.04)]">
      <div className="flex items-center gap-2.5">
        <Avatar name={author ? author.name || author.handle : "?"} hue={author?.hue ?? 200} src={author?.avatarUrl} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold">{author ? author.name || `@${author.handle}` : t("common.anExplorer")}</div>
          <div className="truncate text-[11.5px] text-muted">
            {showCommunity && post.community ? `${post.community.name} · ` : ""}{relTime(post.createdAt)}
          </div>
        </div>
        <StatusNote status={post.status} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-accent uppercase">
        <KindIcon size={13} /> {t(`community.kinds.${post.kind}`)}
      </div>
      <h3 className="font-display mt-1 text-[19px] leading-snug font-semibold">
        <button onClick={(e) => { e.stopPropagation(); go(); }} className="text-left">{post.title}</button>
      </h3>
      <p className="mt-1 line-clamp-3 text-[14px] text-ink/80">{post.body}</p>
      {post.photos.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {post.photos.slice(0, 4).map((src, i) => (
            <img key={src} src={src} alt={t("detail.photo", { n: i + 1 })} loading="lazy" className="h-28 w-36 shrink-0 rounded-2xl object-cover" />
          ))}
        </div>
      )}
      {(dest || post.place) && (
        <div className="mt-3 inline-flex max-w-full items-center gap-1 rounded-full bg-chip px-2.5 py-1 text-[12px] font-semibold">
          <MapPin size={12} className="shrink-0 text-accent" /> <span className="truncate">{[post.place, dest?.name].filter(Boolean).join(" · ")}</span>
        </div>
      )}
      <div className="-mx-1.5 mt-2 flex items-center gap-1">
        <LikeButton post={post} />
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-bold text-ink/75">
          <MessageCircle size={17} /> {compact(post.comments)}
          <span className="sr-only">{t("community.commentsN", { count: post.comments })}</span>
        </span>
        <span className="flex-1" />
        <PostSaveButton post={post} />
      </div>
    </article>
  );
}
