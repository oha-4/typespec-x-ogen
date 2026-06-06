import "@typespec/http";
import "typespec-x-ogen";

using Http;
using TypespecXOgen;

@service(#{ title: "Pet Store" })
@server("https://api.example.com", "Production endpoint")
@ogenServerName("https://api.example.com", "production")
namespace PetStore;

@ogenName("PetStatus")
enum Status {
  available,
  pending,
  sold,
}

@ogenName("PetModel")
model Pet {
  @ogenName("Identifier")
  @ogenExtraTags(#{ gorm: "primaryKey", valid: "customIdValidator" })
  id: int64;

  name: string;
  status: Status;
}

@ogenOperationGroup("Pets")
interface Pets {
  @get list(): Pet[];

  @ogenJsonStreaming
  @post
  create(@body pet: Pet): Pet;
}

@route("/health")
@ogenOperationGroup("System")
@get
op health(): string;
