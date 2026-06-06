import "@typespec/http";
import "typespec-x-ogen";

using Http;
using TypespecXOgen;

// x-ogen-server-name: name each @server (matched by URL) — patched by the emitter.
@service(#{ title: "Pet Store" })
@server("https://api.example.com", "Production endpoint")
@server("https://staging.example.com", "Staging endpoint")
@ogenServerName("https://api.example.com", "production")
@ogenServerName("https://staging.example.com", "staging")
namespace PetStore;

// x-ogen-name on an enum type.
@ogenName("PetStatus")
enum Status {
  available,
  pending,
  sold,
}

// x-ogen-name on a union type.
@ogenName("PetKind")
union Kind {
  cat: "cat",
  dog: "dog",
}

// x-ogen-name on a scalar type.
@ogenName("PetWeight")
scalar grams extends int32;

// Shared fields spread into models below. Their @ogenName / @ogenExtraTags ride
// the spread onto every target model (the rename lands on the spread target,
// not just here).
model Timestamps {
  @ogenName("CreatedAt")
  @ogenExtraTags(#{ gorm: "autoCreateTime" })
  createdAt: utcDateTime;

  @ogenName("UpdatedAt")
  updatedAt: utcDateTime;
}

// x-ogen-name on a model type, plus per-property x-ogen-properties /
// x-oapi-codegen-extra-tags, plus inherited names via the spread.
@ogenName("PetModel")
model Pet {
  ...Timestamps;

  @ogenName("Identifier")
  @ogenExtraTags(#{ gorm: "primaryKey", valid: "customIdValidator" })
  id: int64;

  name: string;
  weight: grams;
  status: Status;
  kind: Kind;
}

// x-ogen-operation-group cascades over the interface; one op overrides it.
// x-ogen-json-streaming in all three forms (both / response-only / request-only).
@ogenOperationGroup("Pets")
@route("/pets")
interface Pets {
  @get list(): Pet[];

  @ogenJsonStreaming
  @post
  create(@body pet: Pet): Pet;

  @route("/{id}")
  @ogenJsonStreaming("response")
  @get
  read(@path id: int64): Pet;

  @route("/{id}")
  @ogenOperationGroup("PetsAdmin")
  @ogenJsonStreaming("request")
  @put
  update(@path id: int64, @body pet: Pet): Pet;
}

// x-ogen-operation-group cascading from a namespace.
@ogenOperationGroup("Store")
namespace Store {
  @route("/store/inventory")
  @get
  op inventory(): Record<int32>;
}

// x-ogen-operation-group on a single operation.
@route("/health")
@ogenOperationGroup("System")
@get
op health(): string;
