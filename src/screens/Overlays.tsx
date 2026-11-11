import { useUi, type Overlay } from "../store/ui";
import { DestinationSheet, EventSheet, GemSheet, ProfileSheet } from "./sheets/Detail";
import { AddStopSheet, AddTipSheet, AddToTripSheet, EditProfileSheet, NewTripSheet, ReportSheet, ShareGemSheet } from "./sheets/Forms";
import { CommunityFormSheet, CommunitySheet, MembersSheet, PeopleSheet, PostFormSheet, PostSheet } from "./sheets/Community";
import { AuthSheet, ChangeEmailSheet, GuidelinesSheet, ModerationSheet, PasswordSheet, SettingsSheet, UpdatesSheet, XpLogSheet } from "./sheets/Account";

export function Overlays() {
  const overlays = useUi((s) => s.overlays);
  const close = useUi((s) => s.close);
  return (
    <>
      {overlays.map((o, i) => <OverlayView key={`${i}-${o.type}`} o={o} onClose={close} />)}
    </>
  );
}

function OverlayView({ o, onClose }: { o: Overlay; onClose: () => void }) {
  switch (o.type) {
    case "destination": return <DestinationSheet id={o.id} onClose={onClose} />;
    case "gem": return <GemSheet id={o.id} onClose={onClose} />;
    case "event": return <EventSheet id={o.id} onClose={onClose} />;
    case "profile": return <ProfileSheet id={o.id} onClose={onClose} />;
    case "shareGem": return <ShareGemSheet destinationId={o.destinationId} fromPost={o.fromPost} onClose={onClose} />;
    case "community": return <CommunitySheet id={o.id} onClose={onClose} />;
    case "post": return <PostSheet id={o.id} onClose={onClose} />;
    case "postForm": return <PostFormSheet communityId={o.communityId} postId={o.postId} onClose={onClose} />;
    case "communityForm": return <CommunityFormSheet id={o.id} onClose={onClose} />;
    case "members": return <MembersSheet communityId={o.communityId} onClose={onClose} />;
    case "people": return <PeopleSheet userId={o.userId} which={o.which} onClose={onClose} />;
    case "newTrip": return <NewTripSheet destinationId={o.destinationId} items={o.items} onClose={onClose} />;
    case "addToTrip": return <AddToTripSheet o={o} onClose={onClose} />;
    case "report": return <ReportSheet o={o} onClose={onClose} />;
    case "addTip": return <AddTipSheet destinationId={o.destinationId} onClose={onClose} />;
    case "addStop": return <AddStopSheet tripId={o.tripId} day={o.day} onClose={onClose} />;
    case "editProfile": return <EditProfileSheet onClose={onClose} />;
    case "settings": return <SettingsSheet onClose={onClose} />;
    case "moderation": return <ModerationSheet onClose={onClose} />;
    case "xpLog": return <XpLogSheet onClose={onClose} />;
    case "updates": return <UpdatesSheet onClose={onClose} />;
    case "guidelines": return <GuidelinesSheet onClose={onClose} />;
    case "auth": return <AuthSheet reason={o.reason} onClose={onClose} />;
    case "setPassword": return <PasswordSheet mode="reset" onClose={onClose} />;
    case "changePassword": return <PasswordSheet mode="change" onClose={onClose} />;
    case "changeEmail": return <ChangeEmailSheet onClose={onClose} />;
  }
}
